import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import {
  credentialCreateSchema, credentialSchema, mcpCapabilitySchema, mcpExchangeSchema,
  taskAssigneeQuerySchema, taskCreateSchema, taskCursorSchema, taskEtag, taskListQuerySchema,
  taskPatchSchema, taskSchema, taskStatusSchema, taskUpdatedAtFromEtag, taskUserRefSchema,
} from '@/lib/tasksApiContracts'

export type TaskOperation = 'tasks.list'|'tasks.get'|'tasks.create'|'tasks.update'|'statuses.list'|'assignees.list'|'credentials.list'|'credentials.create'|'credentials.revoke'|'mcp.exchange'
export type DispatchArgs = {
  p_operation:TaskOperation; p_payload:Record<string, unknown>; p_auth_user_id:string|null;
  p_token_digest:string|null; p_idempotency_key:string|null; p_request_id:string;
}
export type DispatchResult = {status:number;data?:unknown;error?:{code:string;message:string}}
export type TasksApiConfig = {readEnabled:boolean;writeEnabled:boolean;exchangeSecret?:string;isVercel?:boolean}
export type TasksApiDependencies = {
  verifyBrowser:(token:string)=>Promise<string|null>;
  dispatch:(args:DispatchArgs)=>Promise<DispatchResult>;
  config:()=>TasksApiConfig;
}
export const TASK_TOKEN_PREFIXES = {api:'omnia_api_',mcp:'omnia_mcp_',capability:'omnia_cap_'} as const
const methods:Record<TaskOperation,string> = {'tasks.list':'GET','tasks.get':'GET','tasks.create':'POST','tasks.update':'PATCH','statuses.list':'GET','assignees.list':'GET','credentials.list':'GET','credentials.create':'POST','credentials.revoke':'DELETE','mcp.exchange':'POST'}
const errors:Record<string,{status:number;message:string}> = {
  INVALID_OPERATION:{status:400,message:'Invalid operation'}, INVALID_AUTH:{status:401,message:'Authentication required'},
  INVALID_CREDENTIAL:{status:401,message:'Invalid or expired credential'},ACTOR_DISABLED:{status:403,message:'User is inactive'},
  INVALID_AUDIENCE:{status:403,message:'Credential audience is not allowed'},FORBIDDEN:{status:403,message:'Access denied'},
  INSUFFICIENT_SCOPE:{status:403,message:'Required scope is missing'},VALIDATION_ERROR:{status:400,message:'Invalid request'},
  UNSUPPORTED_PRECONDITION_HEADER:{status:400,message:'Use X-Omnia-If-Match instead of If-Match on this deployment'},
  NOT_FOUND:{status:404,message:'Resource not found'},CONFLICT:{status:409,message:'Resource conflict'},
  IDEMPOTENCY_CONFLICT:{status:409,message:'Idempotency key was used for another request'},PRECONDITION_REQUIRED:{status:428,message:'Strong If-Match is required'},
  PRECONDITION_FAILED:{status:412,message:'Task changed; reload before updating'},RATE_LIMITED:{status:429,message:'Request limit exceeded'},
  INTEGRATIONS_DISABLED:{status:503,message:'Integrations are unavailable'},PAYLOAD_TOO_LARGE:{status:413,message:'Request body is too large'},
  UNSUPPORTED_MEDIA_TYPE:{status:415,message:'JSON content type required'},METHOD_NOT_ALLOWED:{status:405,message:'Method not allowed'},
  INTERNAL_ERROR:{status:500,message:'Unable to complete request'},
}
class ApiError extends Error { constructor(readonly code:string) {super(code)} }
function fail(code:string):never {throw new ApiError(code)}
function digest(value:string) { return createHash('sha256').update(value).digest('hex') }
function generateToken(prefix:string) {return prefix + randomBytes(32).toString('base64url')}
function bearer(request:Request) {
  const value=request.headers.get('authorization')
  const token=value?.match(/^Bearer ([A-Za-z0-9_.-]+)$/i)?.[1]
  if (!token || token.length > 8192) fail('INVALID_AUTH')
  return token
}
function tokenAudience(token:string):'api'|'mcp'|'capability'|'browser' {
  for (const [audience,prefix] of Object.entries(TASK_TOKEN_PREFIXES)) {
    if (token.startsWith(prefix)) {
      if (!new RegExp('^'+prefix+'[A-Za-z0-9_-]{43}$').test(token)) fail('INVALID_CREDENTIAL')
      return audience as 'api'|'mcp'|'capability'
    }
  }
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) fail('INVALID_AUTH')
  return 'browser'
}
function query(request:Request) {
  const params=new URL(request.url).searchParams
  const result:Record<string,string>={}
  for (const [key,value] of params) {
    if (Object.hasOwn(result,key)) fail('VALIDATION_ERROR')
    Object.defineProperty(result,key,{value,enumerable:true,configurable:true,writable:true})
  }
  return result
}
export function encodeTaskCursor(cursor:unknown):string {return Buffer.from(JSON.stringify(taskCursorSchema.parse(cursor))).toString('base64url')}
export function decodeTaskCursor(cursor:string) {
  if (!/^[A-Za-z0-9_-]+$/.test(cursor) || cursor.length>1000) fail('VALIDATION_ERROR')
  try {
    const result=taskCursorSchema.parse(JSON.parse(Buffer.from(cursor,'base64url').toString('utf8')))
    if (encodeTaskCursor(result)!==cursor) fail('VALIDATION_ERROR')
    return result
  } catch {return fail('VALIDATION_ERROR')}
}
async function jsonBody(request:Request):Promise<unknown> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')??'')) fail('UNSUPPORTED_MEDIA_TYPE')
  const max=65536
  const declared=request.headers.get('content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared)>max)) fail('PAYLOAD_TOO_LARGE')
  const reader=request.body?.getReader()
  if (!reader) fail('VALIDATION_ERROR')
  const chunks:Uint8Array[]=[];let size=0
  try {
    while (true) {
      const {done,value}=await reader.read();if(done)break
      size+=value.byteLength
      if(size>max){await reader.cancel();fail('PAYLOAD_TOO_LARGE')}
      chunks.push(value)
    }
  } finally {reader.releaseLock()}
  try {return JSON.parse(Buffer.concat(chunks).toString('utf8'))} catch {return fail('VALIDATION_ERROR')}
}
function parse<T>(schema:z.ZodType<T, z.ZodTypeDef, unknown>, value:unknown):T {
  try {return schema.parse(value)} catch {return fail('VALIDATION_ERROR')}
}
function idempotency(request:Request) {
  const key=request.headers.get('idempotency-key')
  if(!key || !/^[\x21-\x7E]{1,200}$/.test(key) || key.includes(','))fail('VALIDATION_ERROR')
  return key
}
function output(operation:TaskOperation,data:unknown):unknown {
  switch(operation) {
    case 'tasks.list':{
      const list=z.object({items:z.array(taskSchema),nextCursor:taskCursorSchema.nullable()}).strict().parse(data)
      return {...list,nextCursor:list.nextCursor ? encodeTaskCursor(list.nextCursor):null}
    }
    case 'tasks.get': case 'tasks.create': case 'tasks.update':return taskSchema.parse(data)
    case 'statuses.list':return z.array(taskStatusSchema).parse(data)
    case 'assignees.list':return z.array(taskUserRefSchema).parse(data)
    case 'credentials.list':return z.array(credentialSchema).parse(data)
    case 'credentials.create':case 'credentials.revoke':return credentialSchema.parse(data)
    case 'mcp.exchange':return mcpCapabilitySchema.parse(data)
  }
}
/** All callers cross the same validation/auth boundary. The injected transport exposes only one RPC. */
export function createTasksApiHandler(deps:TasksApiDependencies) {
  return async (request:Request,operation:TaskOperation,id?:string):Promise<Response> => {
    const suppliedId=request.headers.get('x-request-id')
    const requestId=suppliedId && z.string().uuid().safeParse(suppliedId).success ? suppliedId : randomUUID()
    const headers:Record<string,string>={'Cache-Control':'no-store','X-Request-Id':requestId}
    try {
      if(request.method!==methods[operation])fail('METHOD_NOT_ALLOWED')
      const token=bearer(request)
      const standardMatch=request.headers.get('if-match')
      // Reject before any dispatch: Vercel can fail standard conditionals after a committed write.
      if(standardMatch!==null && deps.config().isVercel)fail('UNSUPPORTED_PRECONDITION_HEADER')
      const isExchange=operation==='mcp.exchange'
      const isManagement=operation.startsWith('credentials.')
      let authUserId:string|null=null,tokenDigest:string|null=null,rawToken:string|undefined
      let integration=false
      const params=query(request)
      let payload:Record<string,unknown>={}
      let idempotencyKey:string|null=null
      if(isExchange){
        const config=deps.config()
        const secret=config.exchangeSecret
        if (!secret || !timingSafeEqual(Buffer.from(digest(secret),'hex'),Buffer.from(digest(token),'hex')))fail('INVALID_AUTH')
        if(!config.readEnabled && !config.writeEnabled)fail('INTEGRATIONS_DISABLED')
        parse(z.object({}).strict(),params)
        const body=parse(mcpExchangeSchema,await jsonBody(request))
        if(tokenAudience(body.mcpKey)!=='mcp')fail('INVALID_AUDIENCE')
        tokenDigest=digest(body.mcpKey);rawToken=generateToken(TASK_TOKEN_PREFIXES.capability)
        payload={sessionDigest:digest(rawToken)}
      }else{
        const audience=tokenAudience(token)
        integration=audience!=='browser'
        if(audience==='mcp' || (integration && isManagement))fail('INVALID_AUDIENCE')
        if(integration){
          const config=deps.config()
          const write=operation==='tasks.create'||operation==='tasks.update'
          if(write ? !config.writeEnabled : !config.readEnabled)fail('INTEGRATIONS_DISABLED')
          tokenDigest=digest(token)
        }else{
          authUserId=await deps.verifyBrowser(token)
          if(!authUserId || !z.string().uuid().safeParse(authUserId).success)fail('INVALID_AUTH')
        }
        if(operation==='tasks.list'){
          const list=parse(taskListQuerySchema,params)
          payload={...list,...(list.cursor?{cursor:decodeTaskCursor(list.cursor)}:{})}
        }else if(operation==='assignees.list')payload=parse(taskAssigneeQuerySchema,params)
        else{
          parse(z.object({}).strict(),params)
          if(operation==='tasks.get'||operation==='tasks.update'||operation==='credentials.revoke')payload.id=parse(z.string().uuid(),id)
          if(operation==='tasks.create'||operation==='tasks.update'){
            idempotencyKey=idempotency(request)
            if(operation==='tasks.update'){
              const transportMatch=request.headers.get('x-omnia-if-match')
              if(standardMatch!==null && transportMatch!==null && standardMatch!==transportMatch)fail('VALIDATION_ERROR')
              const match=transportMatch??standardMatch;if(!match)fail('PRECONDITION_REQUIRED')
              try {payload.expectedUpdatedAt=taskUpdatedAtFromEtag(match)}catch{fail('VALIDATION_ERROR')}
            }
            const body=await jsonBody(request)
            const fields=parse(operation==='tasks.create'?taskCreateSchema:taskPatchSchema,body)
            if(integration && Object.hasOwn(fields,'recurrence'))fail('FORBIDDEN')
            payload=operation==='tasks.create'?fields:{...payload,patch:fields}
          }else if(operation==='credentials.create'){
            const body=parse(credentialCreateSchema,await jsonBody(request))
            rawToken=generateToken(TASK_TOKEN_PREFIXES[body.audience])
            payload={...body,tokenDigest:digest(rawToken)}
          }
        }
      }
      const result=await deps.dispatch({p_operation:operation,p_payload:payload,p_auth_user_id:authUserId,p_token_digest:tokenDigest,p_idempotency_key:idempotencyKey,p_request_id:requestId})
      if(result.error){
        if(!errors[result.error.code] || errors[result.error.code].status!==result.status)fail('INTERNAL_ERROR')
        fail(result.error.code)
      }
      const expectedStatus=operation==='tasks.create'||operation==='credentials.create'||isExchange?201:200
      if(result.status!==expectedStatus)fail('INTERNAL_ERROR')
      let data=output(operation,result.data)
      if(operation==='tasks.get'||operation==='tasks.create'||operation==='tasks.update')headers.ETag=taskEtag((data as {updatedAt:string}).updatedAt)
      if(rawToken)data={...(data as Record<string,unknown>),token:rawToken}
      return Response.json({data,requestId},{status:result.status,headers})
    }catch(error){
      const code=error instanceof ApiError ? error.code : 'INTERNAL_ERROR'
      const typed=errors[code]??errors.INTERNAL_ERROR
      if(typed.status===429)headers['Retry-After']='60'
      if(typed.status===405)headers.Allow=methods[operation]
      return Response.json({error:{code,message:typed.message},requestId},{status:typed.status,headers})
    }
  }
}
