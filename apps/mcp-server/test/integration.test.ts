import assert from 'node:assert/strict'
import { createServer, request as httpRequest, type Server } from 'node:http'
import { after, before, test } from 'node:test'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { createApiClient, ApiFailure } from '../src/api.js'
import { createOmniaMcpHandler } from '../src/server.js'

const uid = '11111111-1111-4111-8111-111111111111'
const statusId = '22222222-2222-4222-8222-222222222222'
const mcpKey = 'omnia_mcp_' + 'a'.repeat(43)
const cap = 'omnia_cap_' + 'b'.repeat(43)
const otherKey = 'omnia_mcp_' + 'c'.repeat(43)
const otherCap = 'omnia_cap_' + 'd'.repeat(43)
const task = {
  id: uid, ticketId: 12, ticketOcta: null, title: 'Test task', description: null,
  priority: 'NORMAL', dueDate: null, statusId, assignedToId: null, createdById: uid,
  tags: [], isPrivate: false, oportunidadeId: null, commentCount: 0, attachmentCount: 0,
  recurrenceId: null, recurrenceOccurrence: null, createdAt: '2026-10-04T12:00:00.000001+00:00',
  updatedAt: '2026-10-04T12:00:00.123456+00:00', assignedTo: null, createdBy: null, recurrence: null,
}
const commentId = '44444444-4444-4444-8444-444444444444'
const comment = {id:commentId,taskId:uid,body:'Olá',authorId:uid,author:null,createdAt:'2026-10-04T12:02:00.000001+00:00'}
const version = '"MjAyNi0xMC0wNFQxMjowMDowMC4xMjM0NTYrMDA6MDA"'
const updatedVersion = '"MjAyNi0xMC0wNFQxMjowMTowMC42NTQzMjErMDA6MDA"'
const updatedTask = {...task,title:'Changed',updatedAt:'2026-10-04T12:01:00.654321+00:00'}
let api: Server, mcp: Server, apiPort: number, mcpPort: number
let requests: Array<{method:string;path:string;authorization:string|undefined;body:unknown;headers:Record<string,string|undefined>}>
let revoked = false
let redirectExchange = false
let staleVersion = false
let rateLimitExchange = false
let oversizedList = false
let slowStatusBody = false
let badEtag = false
let commentForbidden = false

before(async () => {
  requests = []
  api = createServer(async (req,res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined
    const path = req.url ?? ''
    requests.push({method:req.method ?? '',path,authorization:req.headers.authorization,body,headers:{'if-match':String(req.headers['if-match']??''),'x-omnia-if-match':String(req.headers['x-omnia-if-match']??''),'idempotency-key':String(req.headers['idempotency-key']??'')}})
    res.setHeader('Content-Type','application/json')
    res.setHeader('X-Request-Id',uid)
    // Model a compression layer that weakens entity tags for encoded responses.
    const responseVersion = req.headers['accept-encoding']==='identity'?version:`W/${version}`
    if (path === '/api/v1/mcp/exchange') {
      if (revoked) {res.statusCode=401;res.end(JSON.stringify({error:{code:'INVALID_CREDENTIAL',message:'Invalid or expired credential'},requestId:uid}));return}
      if (rateLimitExchange) {res.statusCode=429;res.setHeader('Retry-After','60');res.end(JSON.stringify({error:{code:'RATE_LIMITED',message:'Request limit exceeded'},requestId:uid}));return}
      if (redirectExchange) {res.statusCode=302;res.setHeader('Location','http://127.0.0.1:1/steal');res.end('{}');return}
      res.statusCode=201
      res.end(JSON.stringify({data:{id:uid,audience:'api',scopes:['tasks:read','tasks:create','tasks:update','tasks:comment'],expiresAt:'2999-10-04T13:00:00Z',token:body.mcpKey===otherKey?otherCap:cap},requestId:uid}))
      return
    }
    if (path === `/api/v1/tasks/${uid}` && req.method === 'GET') {res.setHeader('ETag',badEtag?'"YWJj"':responseVersion);res.end(JSON.stringify({data:task,requestId:uid}));return}
    if (path === `/api/v1/tasks/${uid}` && req.method === 'PATCH') {
      // Model the platform rejecting a response after a valid standard conditional request.
      if(req.headers['if-match']) {res.statusCode=412;res.removeHeader('X-Request-Id');res.setHeader('Content-Type','text/plain');res.end('PRECONDITION_FAILED');return}
      if(staleVersion) {res.statusCode=412;res.end(JSON.stringify({error:{code:'PRECONDITION_FAILED',message:'Task changed; reload before updating'},requestId:uid}));return}
      res.setHeader('ETag',req.headers['accept-encoding']==='identity'?updatedVersion:`W/${updatedVersion}`);res.end(JSON.stringify({data:updatedTask,requestId:uid}));return
    }
    if (path === '/api/v1/tasks' && req.method === 'POST' && Array.isArray(body?.tags) && body.tags.includes('inexistente')) {res.statusCode=400;res.end(JSON.stringify({error:{code:'UNKNOWN_TAG',message:'Tag is not in the catalog; list the valid names first'},requestId:uid}));return}
    if (path === '/api/v1/tasks' && req.method === 'POST') {res.statusCode=201;res.setHeader('ETag',responseVersion);res.end(JSON.stringify({data:task,requestId:uid}));return}
    if (path.startsWith('/api/v1/tasks?')) {res.end(JSON.stringify({data:{items:oversizedList?Array.from({length:11},(_,i)=>({...task,id:i===0?uid:`${String(i).padStart(8,'0')}-1111-4111-8111-111111111111`,description:'x'.repeat(50000)})):[task],nextCursor:null},requestId:uid}));return}
    if (path === '/api/v1/task-statuses') {
      if(slowStatusBody) {res.flushHeaders();setTimeout(()=>res.end(JSON.stringify({data:[],requestId:uid})),100);return}
      res.end(JSON.stringify({data:[{id:statusId,name:'Open',color:null,order:1,isDefault:true,isFinal:false}],requestId:uid}));return
    }
    if (path.startsWith(`/api/v1/tasks/${uid}/comments`)) {
      if (commentForbidden && req.method !== 'GET') {res.statusCode=403;res.end(JSON.stringify({error:{code:'FORBIDDEN',message:'Access denied'},requestId:uid}));return}
      if (req.method === 'GET') {res.end(JSON.stringify({data:{items:[comment],nextCursor:null},requestId:uid}));return}
      if (req.method === 'POST') {res.statusCode=201;res.end(JSON.stringify({data:comment,requestId:uid}));return}
      res.end(JSON.stringify({data:comment,requestId:uid}));return
    }
    if (path.startsWith('/api/v1/task-tags')) {res.end(JSON.stringify({data:[{id:statusId,name:'Urgente',color:'#ef4444'}],requestId:uid}));return}
    if (path.startsWith('/api/v1/task-assignees')) {res.end(JSON.stringify({data:[],requestId:uid}));return}
    res.statusCode=404;res.end(JSON.stringify({error:{code:'NOT_FOUND',message:'Resource not found'},requestId:uid}))
  })
  await new Promise<void>(resolve => api.listen(0,'127.0.0.1',resolve))
  apiPort = (api.address() as {port:number}).port
  mcp = createOmniaMcpHandler({apiBaseUrl:`http://127.0.0.1:${apiPort}`,exchangeSecret:'test-service-secret',allowedHosts:['127.0.0.1'],allowedOrigins:[],allowInsecureLocalhost:true})
  await new Promise<void>(resolve => mcp.listen(0,'127.0.0.1',resolve))
  mcpPort = (mcp.address() as {port:number}).port
})
after(async () => {
  await Promise.all([new Promise<void>(resolve=>mcp.close(()=>resolve())),new Promise<void>(resolve=>api.close(()=>resolve()))])
})
async function clientFor(key=mcpKey,modern=false) {
  const client = new Client({name:'omnia-test',version:'1.0.0'},modern?{versionNegotiation:{mode:{pin:'2026-07-28'}}}:undefined)
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${mcpPort}/mcp`),{requestInit:{headers:{Authorization:`Bearer ${key}`}}})
  await client.connect(transport)
  return client
}

test('official client negotiates, lists eleven tools, and exchanges on initialize and list', async () => {
  const client = await clientFor(mcpKey,true)
  try {
    const tools=(await client.listTools()).tools
    assert.deepEqual(tools.map(tool=>tool.name).sort(),['create_task','create_task_comment','delete_task_comment','get_task','list_task_comments','list_task_statuses','list_task_tags','list_tasks','search_task_assignees','update_task','update_task_comment'])
    const annotations=(name:string)=>tools.find(tool=>tool.name===name)?.annotations
    assert.equal(annotations('list_task_comments')?.readOnlyHint,true)
    assert.equal(annotations('create_task_comment')?.readOnlyHint,false)
    assert.equal(annotations('create_task_comment')?.destructiveHint,false)
    assert.equal(annotations('update_task_comment')?.destructiveHint,true)
    assert.equal(annotations('delete_task_comment')?.destructiveHint,true)
    assert.equal(tools.find(tool=>tool.name==='update_task')?.annotations?.destructiveHint,true)
    assert.ok(requests.filter(r=>r.path==='/api/v1/mcp/exchange').length>=2)
    assert.equal(requests[0]?.authorization,'Bearer test-service-secret')
    assert.deepEqual(requests[0]?.body,{mcpKey})
  } finally {await client.close()}
})

test('legacy client can list, create, and query status, tag and assignee routes', async () => {
  const client=await clientFor()
  try {
    const list=await client.callTool({name:'list_tasks',arguments:{limit:2,mine:true,tags:['urgent']}})
    assert.equal((list.structuredContent as {data:{items:unknown[]}}).data.items.length,1)
    const created=await client.callTool({name:'create_task',arguments:{title:'Test task',idempotencyKey:'create-key-1'}})
    assert.equal(created.isError,undefined)
    assert.equal((created.structuredContent as {version:string}).version,version)
    await client.callTool({name:'list_task_statuses',arguments:{}})
    await client.callTool({name:'search_task_assignees',arguments:{query:'Jo',limit:3}})
    const tagList=await client.callTool({name:'list_task_tags',arguments:{}})
    assert.equal((tagList.structuredContent as {data:{name:string}[]}).data[0]?.name,'Urgente')
    await client.callTool({name:'list_task_tags',arguments:{query:'urg'}})
    const calls=requests.filter(r=>r.method!=='POST'||r.path!=='/api/v1/mcp/exchange')
    assert.ok(calls.some(r=>r.path==='/api/v1/tasks?limit=2&mine=true&tags=%5B%22urgent%22%5D'&&r.authorization===`Bearer ${cap}`))
    assert.ok(calls.some(r=>r.path==='/api/v1/tasks'&&r.headers['idempotency-key']==='create-key-1'))
    assert.ok(calls.some(r=>r.path==='/api/v1/task-statuses'))
    assert.ok(calls.some(r=>r.path==='/api/v1/task-assignees?query=Jo&limit=3'))
    assert.ok(calls.some(r=>r.path==='/api/v1/task-tags'&&r.authorization===`Bearer ${cap}`))
    assert.ok(calls.some(r=>r.path==='/api/v1/task-tags?query=urg'))
    assert.equal((await client.callTool({name:'list_task_tags',arguments:{unknown:true}})).isError,true)
  } finally {await client.close()}
})

test('updates use the exact version alias through conditional and compression layers, including the next version', async () => {
  const client = await clientFor()
  try {
    const get = await client.callTool({name:'get_task',arguments:{id:uid}})
    assert.equal(get.isError,undefined)
    const receivedVersion = (get.structuredContent as {version:string}).version
    assert.equal(receivedVersion,version)
    const update = await client.callTool({name:'update_task',arguments:{id:uid,version:receivedVersion,idempotencyKey:'caller-key-1',patch:{title:'Changed'}}})
    assert.equal(update.isError,undefined)
    assert.equal((update.structuredContent as {version:string}).version,updatedVersion)
    const call = [...requests].reverse().find(r=>r.method==='PATCH')
    assert.equal(call?.authorization,`Bearer ${cap}`)
    assert.equal(call?.headers['if-match'],'')
    assert.equal(call?.headers['x-omnia-if-match'],version)
    assert.equal(call?.headers['idempotency-key'],'caller-key-1')
    assert.deepEqual(call?.body,{title:'Changed'})
    const next=await client.callTool({name:'update_task',arguments:{id:uid,version:(update.structuredContent as {version:string}).version,idempotencyKey:'caller-key-2',patch:{description:'Next change'}}})
    assert.equal(next.isError,undefined)
    const nextCall=[...requests].reverse().find(r=>r.method==='PATCH')
    assert.equal(nextCall?.headers['if-match'],'')
    assert.equal(nextCall?.headers['x-omnia-if-match'],updatedVersion)
  } finally {await client.close()}
})

test('revoked MCP key cannot initialize a new client', async () => {
  revoked = true
  try {await assert.rejects(clientFor())} finally {revoked = false}
})

test('concurrent callers use separate exchanged capabilities', async () => {
  const [alice,bob]=await Promise.all([clientFor(mcpKey),clientFor(otherKey)])
  try {
    requests.length=0
    await Promise.all([alice.callTool({name:'get_task',arguments:{id:uid}}),bob.callTool({name:'get_task',arguments:{id:uid}})])
    assert.deepEqual(requests.filter(r=>r.method==='GET').map(r=>r.authorization).sort(),[`Bearer ${cap}`,`Bearer ${otherCap}`].sort())
  } finally {await Promise.all([alice.close(),bob.close()])}
})

test('invalid audience, missing bearer, and disallowed Origin fail before exchange', async () => {
  requests.length=0
  const url=`http://127.0.0.1:${mcpPort}/mcp`
  const body=JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}}})
  for (const headers of [{},{Authorization:`Bearer ${cap}`},{Authorization:`Bearer ${mcpKey}`,Origin:'https://evil.example'}]) {
    const requestHeaders=new Headers(headers as Record<string,string>)
    requestHeaders.set('Content-Type','application/json')
    requestHeaders.set('Accept','application/json, text/event-stream')
    const response=await fetch(url,{method:'POST',headers:requestHeaders,body})
    assert.ok(response.status===401||response.status===403)
  }
  assert.equal(requests.length,0)
})

test('strict tool schemas reject recurrence and missing update preconditions without resource calls', async () => {
  const client=await clientFor()
  try {
    requests.length=0
    const create=await client.callTool({name:'create_task',arguments:{title:'No',idempotencyKey:'key',recurrence:null}})
    const update=await client.callTool({name:'update_task',arguments:{id:uid,patch:{title:'No'}}})
    assert.equal(create.isError,true)
    assert.equal(update.isError,true)
    assert.equal(requests.some(r=>r.method==='POST'&&r.path==='/api/v1/tasks'||r.method==='PATCH'),false)
  } finally {await client.close()}
})

test('update rejects a syntactically quoted but noncanonical task version', async () => {
  const client=await clientFor()
  try {
    requests.length=0
    const result=await client.callTool({name:'update_task',arguments:{id:uid,version:'"abc"',idempotencyKey:'key',patch:{title:'No'}}})
    assert.equal(result.isError,true)
    assert.equal(requests.some(r=>r.method==='PATCH'),false)
  } finally {await client.close()}
})

test('get rejects a version that does not represent the exact task updatedAt', async () => {
  const client=await clientFor()
  badEtag=true
  try {
    const result=await client.callTool({name:'get_task',arguments:{id:uid}})
    assert.equal(result.isError,true)
    assert.equal((result.structuredContent as {error:{code:string}}).error.code,'UPSTREAM_INVALID_RESPONSE')
  } finally {badEtag=false;await client.close()}
})

test('API precondition errors preserve code and requestId as safe tool errors', async () => {
  const client=await clientFor()
  staleVersion=true
  try {
    const result=await client.callTool({name:'update_task',arguments:{id:uid,version,idempotencyKey:'key-412',patch:{title:'Changed'}}})
    assert.equal(result.isError,true)
    assert.deepEqual(result.structuredContent,{error:{code:'PRECONDITION_FAILED',message:'Task changed; reload before updating',status:412},requestId:uid})
  } finally {staleVersion=false;await client.close()}
})

test('exchange redirects are rejected and never forward the service secret', async () => {
  redirectExchange=true
  try {
    const response=await fetch(`http://127.0.0.1:${mcpPort}/mcp`,{method:'POST',headers:{Authorization:`Bearer ${mcpKey}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}}})})
    assert.equal(response.status,503)
  } finally {redirectExchange=false}
})

test('valid large list has actionable bounded-output error', async () => {
  const client=await clientFor()
  oversizedList=true
  try {
    const result=await client.callTool({name:'list_tasks',arguments:{limit:100}})
    assert.equal(result.isError,true)
    assert.equal((result.structuredContent as {error:{code:string}}).error.code,'OUTPUT_TOO_LARGE')
    assert.match(JSON.stringify(result.structuredContent),/narrow the query/i)
  } finally {oversizedList=false;await client.close()}
})

test('exchange rate limit returns 429 with Retry-After', async () => {
  rateLimitExchange=true
  try {
    const response=await fetch(`http://127.0.0.1:${mcpPort}/mcp`,{method:'POST',headers:{Authorization:`Bearer ${mcpKey}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}}})})
    assert.equal(response.status,429)
    assert.equal(response.headers.get('retry-after'),'60')
  } finally {rateLimitExchange=false}
})

test('unknown paths and untrusted Host are rejected before API exchange', async () => {
  requests.length=0
  const unknown=await fetch(`http://127.0.0.1:${mcpPort}/other`)
  assert.equal(unknown.status,404)
  const badHost=await new Promise<number>((resolve,reject)=>{
    const req=httpRequest({host:'127.0.0.1',port:mcpPort,path:'/mcp',headers:{Host:'evil.example',Authorization:`Bearer ${mcpKey}`}},res=>{res.resume();resolve(res.statusCode??0)})
    req.on('error',reject);req.end()
  })
  assert.equal(badHost,403)
  assert.equal(requests.length,0)
})

test('authenticated legacy GET on the stateless MCP endpoint returns 405', async () => {
  const response=await fetch(`http://127.0.0.1:${mcpPort}/mcp`,{headers:{Authorization:`Bearer ${mcpKey}`,Accept:'text/event-stream'}})
  assert.equal(response.status,405)
})

test('outbound timeout applies while reading a response body', async () => {
  slowStatusBody=true
  try {
    const apiClient=createApiClient({apiBaseUrl:`http://127.0.0.1:${apiPort}`,exchangeSecret:'test-service-secret',allowedHosts:['127.0.0.1'],allowedOrigins:[],allowInsecureLocalhost:true,timeoutMs:20})
    await assert.rejects(apiClient.resource('/api/v1/task-statuses','GET',cap),error=>error instanceof ApiFailure&&error.code==='UPSTREAM_TIMEOUT')
  } finally {slowStatusBody=false}
})

test('comment tools list, create, edit and delete through the task comment routes with the exchanged capability', async () => {
  const client=await clientFor()
  try {
    requests.length=0
    const list=await client.callTool({name:'list_task_comments',arguments:{taskId:uid,limit:2,cursor:'abc_-'}})
    assert.equal(list.isError,undefined)
    assert.equal((list.structuredContent as {data:{items:{id:string}[]}}).data.items[0]?.id,commentId)
    const created=await client.callTool({name:'create_task_comment',arguments:{taskId:uid,body:'Olá',idempotencyKey:'comment-key-1'}})
    assert.equal(created.isError,undefined)
    const edited=await client.callTool({name:'update_task_comment',arguments:{taskId:uid,commentId,body:'Editado',idempotencyKey:'comment-key-2'}})
    assert.equal(edited.isError,undefined)
    const deleted=await client.callTool({name:'delete_task_comment',arguments:{taskId:uid,commentId}})
    assert.equal(deleted.isError,undefined)
    assert.equal((deleted.structuredContent as {data:{id:string}}).data.id,commentId)
    for (const result of [list,created,edited,deleted]) assert.equal('version' in (result.structuredContent as object),false)
    const calls=requests.filter(r=>r.path!=='/api/v1/mcp/exchange')
    assert.deepEqual(calls.map(r=>`${r.method} ${r.path}`),[
      `GET /api/v1/tasks/${uid}/comments?limit=2&cursor=abc_-`,
      `POST /api/v1/tasks/${uid}/comments`,
      `PATCH /api/v1/tasks/${uid}/comments/${commentId}`,
      `DELETE /api/v1/tasks/${uid}/comments/${commentId}`,
    ])
    assert.ok(calls.every(r=>r.authorization===`Bearer ${cap}`))
    assert.deepEqual(calls[1]?.body,{body:'Olá'})
    assert.equal(calls[1]?.headers['idempotency-key'],'comment-key-1')
    assert.deepEqual(calls[2]?.body,{body:'Editado'})
    assert.equal(calls[2]?.headers['idempotency-key'],'comment-key-2')
    assert.equal(calls[2]?.headers['x-omnia-if-match'],'')
    assert.equal(calls[3]?.body,undefined)
    assert.equal(calls[3]?.headers['idempotency-key'],'')
  } finally {await client.close()}
})

test('comment tool schemas are strict and fail before any resource call', async () => {
  const client=await clientFor()
  try {
    requests.length=0
    const invalid:[string,Record<string,unknown>][]=[
      ['create_task_comment',{taskId:uid,body:'x'}],
      ['create_task_comment',{taskId:uid,body:'   ',idempotencyKey:'k'}],
      ['create_task_comment',{taskId:uid,body:'x'.repeat(10001),idempotencyKey:'k'}],
      ['create_task_comment',{taskId:uid,body:'x',idempotencyKey:'k',authorId:uid}],
      ['create_task_comment',{taskId:'nope',body:'x',idempotencyKey:'k'}],
      ['create_task_comment',{taskId:uid,body:'x',idempotencyKey:'a,b'}],
      ['update_task_comment',{taskId:uid,commentId,body:'x'}],
      ['update_task_comment',{taskId:uid,commentId:'nope',body:'x',idempotencyKey:'k'}],
      ['update_task_comment',{taskId:uid,commentId,body:'x',idempotencyKey:'k',version}],
      ['delete_task_comment',{taskId:uid}],
      ['delete_task_comment',{taskId:uid,commentId,idempotencyKey:'k'}],
      ['list_task_comments',{taskId:uid,limit:0}],
      ['list_task_comments',{taskId:uid,limit:101}],
      ['list_task_comments',{}],
    ]
    for (const [name,args] of invalid) {
      const result=await client.callTool({name,arguments:args})
      assert.equal(result.isError,true,`${name} ${JSON.stringify(args)}`)
    }
    assert.equal(requests.filter(r=>r.path!=='/api/v1/mcp/exchange').length,0)
  } finally {await client.close()}
})

test('comment bodies are trimmed by the tool schema like task titles', async () => {
  const client=await clientFor()
  try {
    requests.length=0
    await client.callTool({name:'create_task_comment',arguments:{taskId:uid,body:'  espaço  ',idempotencyKey:'trim'}})
    assert.deepEqual(requests.find(r=>r.method==='POST'&&r.path.endsWith('/comments'))?.body,{body:'espaço'})
  } finally {await client.close()}
})

test('author-only API denials surface as safe tool errors with code and requestId', async () => {
  const client=await clientFor()
  commentForbidden=true
  try {
    for (const [name,args] of [['update_task_comment',{taskId:uid,commentId,body:'x',idempotencyKey:'forbidden'}],['delete_task_comment',{taskId:uid,commentId}]] as const) {
      const result=await client.callTool({name,arguments:args})
      assert.equal(result.isError,true)
      assert.deepEqual(result.structuredContent,{error:{code:'FORBIDDEN',message:'Access denied',status:403},requestId:uid})
    }
  } finally {commentForbidden=false;await client.close()}
})

test('writing a tag outside the catalog surfaces UNKNOWN_TAG as a safe, actionable tool error', async () => {
  const client=await clientFor()
  try {
    const rejected=await client.callTool({name:'create_task',arguments:{title:'Tagged',tags:['inexistente'],idempotencyKey:'tag-key-1'}})
    assert.equal(rejected.isError,true)
    const error=(rejected.structuredContent as {error:{code:string;message:string;status:number}}).error
    assert.equal(error.code,'UNKNOWN_TAG')
    assert.equal(error.status,400)
    assert.match(error.message,/list the valid names/)
    const tool=(await client.listTools()).tools.find(item=>item.name==='create_task')
    assert.match(JSON.stringify(tool?.inputSchema),/list_task_tags/)
  } finally {await client.close()}
})
