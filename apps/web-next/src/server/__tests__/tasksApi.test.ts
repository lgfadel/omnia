import { describe, expect, it } from 'vitest'
import { createTasksApiHandler, type TasksApiDependencies, type DispatchArgs } from '../tasksApiService'
import { taskCreateSchema, taskPatchSchema, taskListQuerySchema, credentialCreateSchema, taskSchema, taskStatusSchema } from '@/lib/tasksApiContracts'

const actor = '11111111-1111-4111-8111-111111111111'
const taskId = '22222222-2222-4222-8222-222222222222'
const updatedAt = '2026-10-04T10:20:30.123456+00:00'
const task = { id: taskId, ticketId: 42, ticketOcta: 'EXT-42', title: 'Task', description: null, priority: 'URGENTE', dueDate: null, statusId: actor, assignedToId: null, createdById: actor, tags: [], isPrivate: false, oportunidadeId: null, commentCount: 0, attachmentCount: 0, recurrenceId: null, recurrenceOccurrence: null, createdAt: updatedAt, updatedAt, assignedTo: null, createdBy: null, recurrence: null }
const apiKey = 'omnia_api_' + 'A'.repeat(43)
const mcpKey = 'omnia_mcp_' + 'B'.repeat(43)
const capability = 'omnia_cap_' + 'C'.repeat(43)
function harness(options: Partial<TasksApiDependencies> = {}) {
  const calls: DispatchArgs[] = []
  const verified: string[] = []
  const deps: TasksApiDependencies = {
    verifyBrowser: async token => { verified.push(token); return token === 'browser.jwt.token' ? actor : null },
    dispatch: async args => { calls.push(args); return { status: args.p_operation.endsWith('create') || args.p_operation === 'mcp.exchange' ? 201 : 200, data: args.p_operation === 'tasks.list' ? { items: [task], nextCursor: {createdAt: updatedAt, id: taskId} } : args.p_operation === 'mcp.exchange' ? { id:taskId,audience:'api',scopes:['tasks:read'],expiresAt:'2026-12-01T00:00:00+00:00' } : args.p_operation.startsWith('credentials.') ? { id: taskId, name: 'key', audience: 'api', scopes: ['tasks:read'], createdAt: updatedAt, expiresAt: '2026-12-01T00:00:00+00:00', revokedAt: null, lastUsedAt: null } : task } },
    config: () => ({ readEnabled: true, writeEnabled: true, exchangeSecret: 'backend-secret' }),
    ...options,
  }
  return { handle: createTasksApiHandler(deps), calls, verified }
}
function request(path: string, method = 'GET', body?: unknown, headers: Record<string,string> = {}) {
  return new Request('https://omnia.test/api/v1/' + path, { method, headers: { Authorization: 'Bearer browser.jwt.token', ...(body !== undefined ? {'Content-Type': 'application/json'} : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
}
async function code(response: Response) { return (await response.json()).error?.code }

describe('strict public task DTOs', () => {
  it('accepts legacy nullable creator, roles and removed recurrence template', () => {
    const parsed=taskSchema.parse({...task,createdById:null,createdBy:{id:actor,name:'Legacy',email:null,roles:null,avatarUrl:null,color:null},recurrence:{id:taskId,templateTicketId:null,frequency:'DAILY',interval:1,startDate:'2026-10-04',endType:'NEVER',endDate:null,occurrenceLimit:null,generatedOccurrences:1,nextOccurrenceDate:null,isActive:false}})
    expect(parsed.createdById).toBeNull()
    expect(parsed.createdBy?.roles).toEqual([])
    expect(parsed.recurrence?.templateTicketId).toBeNull()
  })
  it('normalizes legacy null status default to false', () => {
    expect(taskStatusSchema.parse({id:actor,name:'Legacy',color:'#000',order:1,isDefault:null,isFinal:false}).isDefault).toBe(false)
  })
  it.each(['createdById','ticketId','commentCount','attachmentCount','id','actor','tokenDigest','updatedAt'])('rejects generated/actor field %s', field => {
    expect(taskCreateSchema.safeParse({title:'Task', [field]: actor}).success).toBe(false)
  })
  it.each(['2026-02-29','2026-04-31','2026-13-01','2026-00-01','0000-01-01','2026-1-01'])('rejects invalid calendar date %s', dueDate => {
    expect(taskCreateSchema.safeParse({ title:'Task',dueDate }).success).toBe(false)
  })
  it('preserves explicit null clears and urgent priority', () => {
    expect(taskPatchSchema.parse({description:null,dueDate:null,ticketOcta:null,assignedToId:null,oportunidadeId:null,priority:'URGENTE'})).toEqual({description:null,dueDate:null,ticketOcta:null,assignedToId:null,oportunidadeId:null,priority:'URGENTE'})
    expect(taskPatchSchema.safeParse({}).success).toBe(false)
  })
  it('validates recurrence bounds', () => {
    expect(taskCreateSchema.safeParse({title:'Task', recurrence:{frequency:'MONTHLY',startDate:'2026-10-04',endType:'ON_DATE',endDate:'2026-10-01'}}).success).toBe(false)
    expect(taskCreateSchema.safeParse({title:'Task', recurrence:{frequency:'WEEKLY',startDate:'2026-10-04',endType:'AFTER_COUNT'}}).success).toBe(false)
  })
  it('bounds queries and scopes', () => {
    expect(taskListQuerySchema.parse({}).limit).toBe(50)
    expect(taskListQuerySchema.safeParse({limit:'101'}).success).toBe(false)
    expect(taskListQuerySchema.safeParse({mine:'false'}).data?.mine).toBe(false)
    expect(taskListQuerySchema.safeParse({actor}).success).toBe(false)
    expect(credentialCreateSchema.safeParse({name:'key',audience:'api',scopes:['admin']}).success).toBe(false)
  })
})

describe('official task HTTP service', () => {
  it('verifies browser bearer and forwards only server-resolved identity', async () => {
    const h = harness(); const res = await h.handle(request('tasks'), 'tasks.list')
    expect(res.status).toBe(200); expect(h.verified).toEqual(['browser.jwt.token'])
    expect(h.calls[0]).toMatchObject({p_auth_user_id:actor,p_token_digest:null,p_payload:{limit:50}})
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const json = await res.json(); expect(json.data.items[0].ticketId).toBe(42); expect(json.data.nextCursor).toMatch(/^[\w-]+$/)
    expect(json.requestId).toMatch(/^[\da-f-]{36}$/)
  })
  it.each(['', 'Bearer bad', 'Bearer browser.jwt.token, Bearer stolen', 'Basic value'])('fails closed auth %s', async authorization => {
    const h = harness(); const res = await h.handle(request('tasks','GET',undefined,{Authorization:authorization}), 'tasks.list')
    expect(res.status).toBe(401); expect(h.calls).toHaveLength(0)
  })
  it.each([apiKey,capability])('hashes resource credentials without persisting raw secret', async token => {
    const h = harness(); const res = await h.handle(request('tasks','GET',undefined,{Authorization:'Bearer '+token}), 'tasks.list')
    expect(res.status).toBe(200); expect(h.verified).toHaveLength(0)
    expect(h.calls[0].p_auth_user_id).toBeNull(); expect(h.calls[0].p_token_digest).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(h.calls)).not.toContain(token)
  })
  it('denies raw MCP key resources and nonbrowser key management', async () => {
    const h = harness()
    expect(await code(await h.handle(request('tasks','GET',undefined,{Authorization:'Bearer '+mcpKey}), 'tasks.list'))).toBe('INVALID_AUDIENCE')
    expect(await code(await h.handle(request('integration-keys','GET',undefined,{Authorization:'Bearer '+apiKey}), 'credentials.list'))).toBe('INVALID_AUDIENCE')
    expect(h.calls).toHaveLength(0)
  })
  it('read/write switches default off for integrations while browser works', async () => {
    const h = harness({config:()=>({readEnabled:false,writeEnabled:false})})
    expect((await h.handle(request('tasks','GET',undefined,{Authorization:'Bearer '+apiKey}), 'tasks.list')).status).toBe(503)
    expect((await h.handle(request('tasks','POST',{title:'Task'},{Authorization:'Bearer '+apiKey,'Idempotency-Key':'key'}), 'tasks.create')).status).toBe(503)
    expect((await h.handle(request('tasks'), 'tasks.list')).status).toBe(200)
  })
  it('allows MCP exchange for write-only integrations and enforces each resource switch', async () => {
    const h=harness({config:()=>({readEnabled:false,writeEnabled:true,exchangeSecret:'backend-secret'})})
    const exchanged=await h.handle(request('mcp/exchange','POST',{mcpKey},{Authorization:'Bearer backend-secret'}),'mcp.exchange')
    expect(exchanged.status).toBe(201)
    const token=(await exchanged.json()).data.token
    expect((await h.handle(request('tasks','GET',undefined,{Authorization:'Bearer '+token}),'tasks.list')).status).toBe(503)
    expect((await h.handle(request('tasks','POST',{title:'Write only'},{Authorization:'Bearer '+token,'Idempotency-Key':'write-only'}),'tasks.create')).status).toBe(201)
    const closed=harness({config:()=>({readEnabled:false,writeEnabled:false,exchangeSecret:'backend-secret'})})
    expect((await closed.handle(request('mcp/exchange','POST',{mcpKey},{Authorization:'Bearer backend-secret'}),'mcp.exchange')).status).toBe(503)
  })
  it('denies integration recurrence even explicit null', async () => {
    const h = harness()
    const res = await h.handle(request('tasks','POST',{title:'Task',recurrence:null},{Authorization:'Bearer '+apiKey,'Idempotency-Key':'key'}), 'tasks.create')
    expect(res.status).toBe(403); expect(h.calls).toHaveLength(0)
  })
  it('requires idempotency and strong match; preserves microseconds', async () => {
    const h = harness()
    const get = await h.handle(request('tasks/'+taskId), 'tasks.get',taskId); const etag = get.headers.get('ETag')!
    expect(etag).toBe('"' + Buffer.from(updatedAt).toString('base64url') + '"')
    expect((await h.handle(request('tasks','POST',{title:'Task'}), 'tasks.create')).status).toBe(400)
    expect((await h.handle(request('tasks/'+taskId,'PATCH',{description:null},{'Idempotency-Key':'retry'}), 'tasks.update',taskId)).status).toBe(428)
    expect((await h.handle(request('tasks/'+taskId,'PATCH',{description:null},{'Idempotency-Key':'retry','If-Match':'W/'+etag}), 'tasks.update',taskId)).status).toBe(400)
    const patched = await h.handle(request('tasks/'+taskId,'PATCH',{description:null},{'Idempotency-Key':'retry','If-Match':etag}), 'tasks.update',taskId)
    expect(patched.status).toBe(200); expect(h.calls.at(-1)?.p_payload).toEqual({id:taskId,expectedUpdatedAt:updatedAt,patch:{description:null}})
  })
  const exactVersion='"MjAyNi0xMC0wNFQxMDoyMDozMC4xMjM0NTYrMDA6MDA"'
  it.each([
    {'If-Match':exactVersion},
    {'X-Omnia-If-Match':exactVersion},
    {'If-Match':exactVersion,'X-Omnia-If-Match':exactVersion},
  ] as Record<string,string>[])('accepts exact task version headers %j without changing the CAS timestamp', async headers => {
    const h=harness()
    const response=await h.handle(request('tasks/'+taskId,'PATCH',{description:null},{...headers,'Idempotency-Key':'alias'}),'tasks.update',taskId)
    expect(response.status).toBe(200)
    expect(response.headers.get('ETag')).toBe(exactVersion)
    expect(h.calls[0]?.p_payload).toEqual({id:taskId,expectedUpdatedAt:updatedAt,patch:{description:null}})
  })
  it.each([
    [{},428],
    [{'X-Omnia-If-Match':''},428],
    [{'X-Omnia-If-Match':'W/'+exactVersion},400],
    [{'X-Omnia-If-Match':'"abc"'},400],
    [{'If-Match':exactVersion,'X-Omnia-If-Match':'"MjAyNi0xMC0wNFQxMDoyMTowMC42NTQzMjErMDA6MDA"'},400],
    [{'If-Match':exactVersion,'X-Omnia-If-Match':''},400],
    [{'If-Match':'W/'+exactVersion,'X-Omnia-If-Match':exactVersion},400],
    [{'If-Match':'W/'+exactVersion,'X-Omnia-If-Match':'W/'+exactVersion},400],
  ] as [Record<string,string>,number][])('rejects missing, weak or conflicting version headers %j with %s before dispatch', async (headers,status) => {
    const h=harness()
    const response=await h.handle(request('tasks/'+taskId,'PATCH',{description:null},{...headers,'Idempotency-Key':'invalid-alias'}),'tasks.update',taskId)
    expect(response.status).toBe(status)
    expect(h.calls).toHaveLength(0)
  })
  it('preserves stale alias PATCH as a typed JSON 412', async () => {
    const h=harness({dispatch:async()=>({status:412,error:{code:'PRECONDITION_FAILED',message:'Task changed'}})})
    const response=await h.handle(request('tasks/'+taskId,'PATCH',{title:'Changed'},{'Idempotency-Key':'stale-alias','X-Omnia-If-Match':exactVersion}),'tasks.update',taskId)
    expect(response.status).toBe(412)
    expect(response.headers.get('Content-Type')).toContain('application/json')
    const json=await response.json()
    expect(json.error.code).toBe('PRECONDITION_FAILED')
    expect(json.requestId).toBe(response.headers.get('X-Request-Id'))
  })
  it.each([
    {'If-Match':exactVersion},
    {'If-Match':exactVersion,'X-Omnia-If-Match':exactVersion},
    {'If-Match':''},
  ] as Record<string,string>[])('rejects standard conditional headers %j on Vercel before dispatch', async headers => {
    const h=harness({config:()=>({readEnabled:true,writeEnabled:true,isVercel:true})})
    const response=await h.handle(request('tasks/'+taskId,'PATCH',{description:null},{...headers,'Idempotency-Key':'standard-on-vercel'}),'tasks.update',taskId)
    expect(response.status).toBe(400)
    expect(h.calls).toHaveLength(0)
    const json=await response.json()
    expect(json.error.code).toBe('UNSUPPORTED_PRECONDITION_HEADER')
    expect(json.error.message).toContain('X-Omnia-If-Match')
    expect(json.requestId).toBe(response.headers.get('X-Request-Id'))
  })
  it('accepts only the version alias on Vercel with the exact same CAS timestamp', async () => {
    const h=harness({config:()=>({readEnabled:true,writeEnabled:true,isVercel:true})})
    const response=await h.handle(request('tasks/'+taskId,'PATCH',{description:null},{'X-Omnia-If-Match':exactVersion,'Idempotency-Key':'alias-on-vercel'}),'tasks.update',taskId)
    expect(response.status).toBe(200)
    expect(h.calls[0]?.p_payload.expectedUpdatedAt).toBe(updatedAt)
    expect(response.headers.get('ETag')).toBe(exactVersion)
  })
  it.each([
    {operation:'tasks.create',path:'tasks',method:'POST',body:{title:'Task'}},
    {operation:'tasks.list',path:'tasks',method:'GET',body:undefined},
    {operation:'tasks.get',path:'tasks/'+taskId,method:'GET',body:undefined},
    {operation:'credentials.create',path:'integration-keys',method:'POST',body:{name:'Key',audience:'api',scopes:['tasks:read']}},
    {operation:'credentials.revoke',path:'integration-keys/'+taskId,method:'DELETE',body:undefined},
    {operation:'mcp.exchange',path:'mcp/exchange',method:'POST',body:{mcpKey}},
  ] as const)('rejects standard conditional transport for $operation on Vercel before any dispatch', async ({operation,path,method,body}) => {
    const h=harness({config:()=>({readEnabled:true,writeEnabled:true,isVercel:true,exchangeSecret:'backend-secret'})})
    const response=await h.handle(request(path,method,body,{'If-Match':exactVersion,'Idempotency-Key':'blocked-operation',...(operation==='mcp.exchange'?{Authorization:'Bearer backend-secret'}:{})}),operation,taskId)
    expect(response.status).toBe(400)
    expect(h.calls).toHaveLength(0)
    const json=await response.json()
    expect(json.error).toMatchObject({code:'UNSUPPORTED_PRECONDITION_HEADER',message:expect.stringContaining('X-Omnia-If-Match')})
    expect(json.requestId).toBe(response.headers.get('X-Request-Id'))
  })
  it.each(['tasks?mine=true&mine=false','tasks?actor='+actor,'tasks?cursor=broken','tasks?limit=0'])('rejects ambiguous query %s', async path => {
    const h = harness(); expect((await h.handle(request(path),'tasks.list')).status).toBe(400); expect(h.calls).toHaveLength(0)
  })
  it('roundtrips cursor without normalizing DB timestamp', async () => {
    const h=harness(); const first=await (await h.handle(request('tasks'),'tasks.list')).json()
    await h.handle(request('tasks?cursor='+first.data.nextCursor+'&mine=true'),'tasks.list')
    expect(h.calls.at(-1)?.p_payload).toMatchObject({mine:true,cursor:{createdAt:updatedAt,id:taskId}})
  })
  it('creates keys with once-only token and digest only in RPC', async () => {
    const h=harness(); const res=await h.handle(request('integration-keys','POST',{name:'Bot',audience:'mcp',scopes:['tasks:read']}),'credentials.create')
    expect(res.status).toBe(201); const json=await res.json(); expect(json.data.token).toMatch(/^omnia_mcp_[\w-]{43}$/)
    expect(h.calls[0].p_payload).toMatchObject({name:'Bot',audience:'mcp',scopes:['tasks:read']})
    expect(h.calls[0].p_payload.tokenDigest).toMatch(/^[a-f0-9]{64}$/); expect(JSON.stringify(h.calls)).not.toContain(json.data.token)
  })
  it('exchange requires separate service auth and MCP audience, rejects chosen identity', async () => {
    const h=harness()
    const exchange=(body:unknown,secret='backend-secret')=>h.handle(request('mcp/exchange','POST',body,{Authorization:'Bearer '+secret}), 'mcp.exchange')
    expect((await exchange({mcpKey},'wrong')).status).toBe(401)
    expect((await exchange({mcpKey:apiKey})).status).toBe(403)
    expect((await exchange({mcpKey,actor})).status).toBe(400)
    expect(h.calls).toHaveLength(0)
    const res=await exchange({mcpKey}); expect(res.status).toBe(201)
    const json=await res.json(); expect(json.data.token).toMatch(/^omnia_cap_[\w-]{43}$/)
    expect(h.calls[0].p_token_digest).toMatch(/^[a-f0-9]{64}$/); expect(h.calls[0].p_auth_user_id).toBeNull()
    expect(h.calls[0].p_payload.sessionDigest).toMatch(/^[a-f0-9]{64}$/)
  })
  it('maps typed DB errors but sanitizes unexpected transport failure', async () => {
    const rate=harness({dispatch:async()=>({status:429,error:{code:'RATE_LIMITED',message:'Budget exceeded'}})})
    const res=await rate.handle(request('tasks'),'tasks.list'); expect(res.status).toBe(429); expect(res.headers.get('Retry-After')).toBe('60'); expect(await code(res)).toBe('RATE_LIMITED')
    const bad=harness({dispatch:async()=>{throw new Error('secret database password')}})
    const err=await bad.handle(request('tasks'),'tasks.list'); expect(err.status).toBe(500); expect(await err.text()).not.toContain('password')
  })
  it('bounds JSON body and rejects content type confusion', async () => {
    const h=harness()
    expect((await h.handle(request('tasks','POST',{title:'x'},{'Content-Type':'text/plain','Idempotency-Key':'k'}),'tasks.create')).status).toBe(415)
    expect((await h.handle(request('tasks','POST',{title:'x',description:'x'.repeat(66000)},{'Idempotency-Key':'k'}),'tasks.create')).status).toBe(413)
    expect(h.calls).toHaveLength(0)
  })
})
