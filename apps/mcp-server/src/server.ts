import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { z } from 'zod/v4'
import { ApiFailure, createApiClient, type Config } from './api.js'

const uuid=z.uuid()
const date=z.iso.date()
const priority=z.enum(['URGENTE','ALTA','NORMAL','BAIXA'])
const tags=z.array(z.string().max(100)).max(50)
const idempotencyKey=z.string().regex(/^[\x21-\x7E]{1,200}$/).refine(value=>!value.includes(','))
const taskFields={
  title:z.string().trim().min(1).max(500).optional(),description:z.string().max(50000).nullable().optional(),
  priority:priority.optional(),dueDate:date.nullable().optional(),ticketOcta:z.string().max(500).nullable().optional(),
  statusId:uuid.optional(),assignedToId:uuid.nullable().optional(),tags:tags.optional(),isPrivate:z.boolean().optional(),
  oportunidadeId:uuid.nullable().optional(),
}
const createSchema=z.object({...taskFields,title:z.string().trim().min(1).max(500),idempotencyKey}).strict()
const patchSchema=z.object(taskFields).strict().refine(value=>Object.keys(value).length>0)
const version=z.string().regex(/^"[A-Za-z0-9_-]{1,190}"$/).max(200).refine(value=>{
  const encoded=value.slice(1,-1)
  const decoded=Buffer.from(encoded,'base64url').toString('utf8')
  return Buffer.from(decoded).toString('base64url')===encoded && z.iso.datetime({offset:true}).safeParse(decoded).success
},'Invalid strong task version')
const updateSchema=z.object({id:uuid,version,idempotencyKey,patch:patchSchema}).strict()
const listSchema=z.object({
  limit:z.number().int().min(1).max(100).optional(),cursor:z.string().min(1).max(1000).optional(),query:z.string().max(500).optional(),
  statusId:uuid.optional(),assignedToId:uuid.optional(),mine:z.boolean().optional(),priority:priority.optional(),
  isPrivate:z.boolean().optional(),oportunidadeId:uuid.optional(),tags:tags.optional(),dueDateFrom:date.optional(),dueDateTo:date.optional(),
}).strict().refine(value=>!value.dueDateFrom||!value.dueDateTo||value.dueDateFrom<=value.dueDateTo)
const commentBody=z.string().trim().min(1).max(10000)
const listCommentsSchema=z.object({taskId:uuid,limit:z.number().int().min(1).max(100).optional(),cursor:z.string().min(1).max(1000).optional()}).strict()
const createCommentSchema=z.object({taskId:uuid,body:commentBody,idempotencyKey}).strict()
const updateCommentSchema=z.object({taskId:uuid,commentId:uuid,body:commentBody,idempotencyKey}).strict()
const deleteCommentSchema=z.object({taskId:uuid,commentId:uuid}).strict()
const assigneeSchema=z.object({query:z.string().max(500).optional(),limit:z.number().int().min(1).max(100).optional()}).strict()

function toolResponse(value:{data:unknown;requestId:string;etag:string|null},requireVersion=false) {
  if (requireVersion) {
    const updatedAt=value.data&&typeof value.data==='object'&&'updatedAt' in value.data ? (value.data as {updatedAt:unknown}).updatedAt : undefined
    if(typeof updatedAt!=='string'||!z.iso.datetime({offset:true}).safeParse(updatedAt).success||value.etag!==`"${Buffer.from(updatedAt).toString('base64url')}"`)
      throw new ApiFailure('UPSTREAM_INVALID_RESPONSE',value.requestId,502,'Omnia API returned an invalid version')
  }
  const structuredContent={data:value.data,requestId:value.requestId,...(value.etag?{version:value.etag}:{})}
  const rendered=JSON.stringify(structuredContent)
  if(Buffer.byteLength(rendered)>262144) throw new ApiFailure('OUTPUT_TOO_LARGE',value.requestId,502,'Task result is too large; narrow the query')
  return {content:[{type:'text' as const,text:rendered}],structuredContent}
}
function errorResponse(error:unknown) {
  const safe=error instanceof ApiFailure?error:new ApiFailure('INTERNAL_ERROR',randomUUID(),500,'Unable to complete request')
  const structuredContent={error:{code:safe.code,message:safe.message,status:safe.status,...(safe.retryAfterSeconds?{retryAfterSeconds:safe.retryAfterSeconds}:{})},requestId:safe.requestId}
  return {isError:true,content:[{type:'text' as const,text:JSON.stringify(structuredContent)}],structuredContent}
}

function createServerFactory(api:ReturnType<typeof createApiClient>) {
  return ({authInfo}:{authInfo?:{token:string}}) => {
    const capability=authInfo?.token
    if(!capability) throw new Error('Missing request capability')
    const server=new McpServer({name:'omnia-tasks',version:'0.1.0'})
    const run=async (path:string,method:string,opts?:{body?:unknown;version?:string;idempotencyKey?:string},needsVersion=false) => {
      try {return toolResponse(await api.resource(path,method,capability,opts),needsVersion)} catch(error) {return errorResponse(error)}
    }
    server.registerTool('list_tasks',{description:'List visible Omnia tasks with filters and cursor pagination.',inputSchema:listSchema,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}},async args=>{
      const query=new URLSearchParams()
      for(const [key,value] of Object.entries(args)) if(value!==undefined) query.set(key,key==='tags'?JSON.stringify(value):String(value))
      return run(`/api/v1/tasks?${query}`,'GET')
    })
    server.registerTool('get_task',{description:'Get one visible task and its strong version for a later update.',inputSchema:z.object({id:uuid}).strict(),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}},async ({id})=>run(`/api/v1/tasks/${id}`,'GET',undefined,true))
    server.registerTool('create_task',{description:'Create a standalone task. Supply a unique caller idempotencyKey and retain it for retries.',inputSchema:createSchema,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false}},async ({idempotencyKey,...body})=>run('/api/v1/tasks','POST',{body,idempotencyKey},true))
    server.registerTool('update_task',{description:'Patch a task with the version returned by get_task and a caller idempotencyKey.',inputSchema:updateSchema,annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false}},async ({id,version,idempotencyKey,patch})=>run(`/api/v1/tasks/${id}`,'PATCH',{body:patch,version,idempotencyKey},true))
    server.registerTool('list_task_statuses',{description:'List available Omnia task statuses.',inputSchema:z.object({}).strict(),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}},async ()=>run('/api/v1/task-statuses','GET'))
    server.registerTool('search_task_assignees',{description:'Search users available for task assignment.',inputSchema:assigneeSchema,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}},async args=>{
      const query=new URLSearchParams()
      if(args.query!==undefined)query.set('query',args.query)
      if(args.limit!==undefined)query.set('limit',String(args.limit))
      return run(`/api/v1/task-assignees${query.size?`?${query}`:''}`,'GET')
    })
    server.registerTool('list_task_comments',{description:'List the comments of a visible task, newest first, with cursor pagination. Use it to find a comment id before editing or deleting.',inputSchema:listCommentsSchema,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}},async ({taskId,limit,cursor})=>{
      const query=new URLSearchParams()
      if(limit!==undefined)query.set('limit',String(limit))
      if(cursor!==undefined)query.set('cursor',cursor)
      return run(`/api/v1/tasks/${taskId}/comments${query.size?`?${query}`:''}`,'GET')
    })
    server.registerTool('create_task_comment',{description:'Add a comment to a visible task as the key owner. Supply a unique caller idempotencyKey and retain it for retries. Requires the tasks:comment scope.',inputSchema:createCommentSchema,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false}},async ({taskId,body,idempotencyKey})=>run(`/api/v1/tasks/${taskId}/comments`,'POST',{body:{body},idempotencyKey}))
    server.registerTool('update_task_comment',{description:'Replace the body of a comment. Only the comment author may edit it, including administrators. Supply a unique caller idempotencyKey. Requires the tasks:comment scope.',inputSchema:updateCommentSchema,annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false}},async ({taskId,commentId,body,idempotencyKey})=>run(`/api/v1/tasks/${taskId}/comments/${commentId}`,'PATCH',{body:{body},idempotencyKey}))
    server.registerTool('delete_task_comment',{description:'Permanently delete a comment and its attachments. Allowed for the comment author or an administrator. Returns the deleted comment; a second call returns NOT_FOUND. Requires the tasks:comment scope.',inputSchema:deleteCommentSchema,annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false}},async ({taskId,commentId})=>run(`/api/v1/tasks/${taskId}/comments/${commentId}`,'DELETE'))
    return server
  }
}

function reject(status:number,code:string,retryAfterSeconds?:number) {
  const requestId=randomUUID()
  return Response.json({error:{code,message:status===401?'Authentication required':code==='INVALID_ORIGIN'?'Origin is not allowed':status===429?'Request limit exceeded':'Request rejected'},requestId},{status,headers:{'Cache-Control':'no-store','X-Request-Id':requestId,...(status===401?{'WWW-Authenticate':'Bearer realm="omnia-mcp"'}:{}),...(retryAfterSeconds?{'Retry-After':String(retryAfterSeconds)}:{})}})
}

export function createOmniaMcpFetchHandler(config:Config) {
  const api=createApiClient(config)
  const handler=createMcpHandler(createServerFactory(api),{maxRequestBodySize:65536})
  return async function fetchHandler(req:Request):Promise<Response> {
    const path=new URL(req.url).pathname
    if(path!=='/mcp' && path!=='/api/mcp') return reject(404,'NOT_FOUND')
    const host=req.headers.get('host')
    const hostname=host?.replace(/:\d+$/,'').toLowerCase()
    if(!hostname || !config.allowedHosts.map(value=>value.toLowerCase()).includes(hostname)) return reject(403,'INVALID_HOST')
    const origin=req.headers.get('origin')
    if(origin && !config.allowedOrigins.includes(origin)) return reject(403,'INVALID_ORIGIN')
    const key=/^Bearer (omnia_mcp_[A-Za-z0-9_-]{43})$/i.exec(req.headers.get('authorization')??'')?.[1]
    if(!key) return reject(401,'INVALID_AUTH')
    try {
      const capability=await api.exchange(key)
      return await handler.fetch(req,{authInfo:{token:capability.token,clientId:capability.id,scopes:capability.scopes,expiresAt:Date.parse(capability.expiresAt)/1000}})
    } catch(error) {
      if(error instanceof ApiFailure && [401,403,429].includes(error.status)) return reject(error.status,error.code,error.retryAfterSeconds)
      return reject(503,'UPSTREAM_UNAVAILABLE')
    }
  }
}

export function createOmniaMcpHandler(config:Config) {
  const nodeHandler=toNodeHandler({fetch:createOmniaMcpFetchHandler(config)},{maxRequestBodySize:65536})
  return createServer((req,res)=>{void nodeHandler(req,res)})
}
