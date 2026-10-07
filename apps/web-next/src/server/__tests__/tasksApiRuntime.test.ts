import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const transport=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),createClient:vi.fn()}))
vi.mock('@supabase/supabase-js',()=>({createClient:transport.createClient}))
import { tasksApiHandler, getTasksApiConfig } from '../tasksApiRuntime'
import { GET as list, POST as create } from '@/app/api/v1/tasks/route'
import { GET as detail, PATCH as patch } from '@/app/api/v1/tasks/[id]/route'
import { GET as statuses } from '@/app/api/v1/task-statuses/route'
import { GET as tags } from '@/app/api/v1/task-tags/route'
import { GET as assignees } from '@/app/api/v1/task-assignees/route'
import { GET as keys, POST as createKey } from '@/app/api/v1/integration-keys/route'
import { DELETE as revoke } from '@/app/api/v1/integration-keys/[id]/route'
import { POST as exchange } from '@/app/api/v1/mcp/exchange/route'
const request=()=>new Request('https://omnia.test/api/v1/tasks',{headers:{Authorization:'Bearer browser.jwt.token'}})
beforeEach(()=>{vi.clearAllMocks();transport.createClient.mockReturnValue({auth:{getUser:transport.getUser},rpc:transport.rpc})})
afterEach(()=>vi.unstubAllEnvs())
it('is importable with absent service configuration and returns sanitized failure lazily',async()=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','')
  const response=await list(request());expect(response.status).toBe(500);expect(await response.text()).not.toContain('SUPABASE')
  expect(transport.createClient).not.toHaveBeenCalled()
})
it('kill switches fail closed unless exactly true',()=>{
  vi.stubEnv('OMNIA_INTEGRATIONS_READ_ENABLED','TRUE');vi.stubEnv('OMNIA_INTEGRATIONS_WRITE_ENABLED','1')
  expect(getTasksApiConfig()).toMatchObject({readEnabled:false,writeEnabled:false})
  vi.stubEnv('OMNIA_INTEGRATIONS_READ_ENABLED','true');expect(getTasksApiConfig().readEnabled).toBe(true)
})
it('blocks standard conditional transport only when the Vercel runtime marker is exactly 1',()=>{
  vi.stubEnv('VERCEL','1');expect(getTasksApiConfig()).toMatchObject({isVercel:true})
  vi.stubEnv('VERCEL','true');expect(getTasksApiConfig()).toMatchObject({isVercel:false})
  vi.stubEnv('VERCEL','');expect(getTasksApiConfig()).toMatchObject({isVercel:false})
})
it('validates browser getUser result and calls the service-only RPC without table access',async()=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.test');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','anon');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','service')
  transport.getUser.mockResolvedValue({data:{user:{id:'11111111-1111-4111-8111-111111111111'}},error:null})
  transport.rpc.mockResolvedValue({data:{status:200,data:[]},error:null})
  const res=await statuses(request());expect(res.status).toBe(200)
  expect(transport.getUser).toHaveBeenCalledWith('browser.jwt.token')
  expect(transport.rpc).toHaveBeenCalledWith('tasks_api_dispatch',expect.objectContaining({p_operation:'statuses.list',p_auth_user_id:'11111111-1111-4111-8111-111111111111',p_token_digest:null}))
  expect(transport.createClient).toHaveBeenCalledWith('https://example.test','service',expect.objectContaining({auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}))
})
it('lists tags through the dispatch RPC, forwarding only the validated query',async()=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.test');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','service');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','anon')
  transport.getUser.mockResolvedValue({data:{user:{id:'11111111-1111-4111-8111-111111111111'}},error:null})
  const tag={id:'22222222-2222-4222-8222-222222222222',name:'Urgente',color:'#ef4444'}
  transport.rpc.mockResolvedValue({data:{status:200,data:[tag]},error:null})
  const res=await tags(new Request('https://omnia.test/api/v1/task-tags?query=urg',{headers:{Authorization:'Bearer browser.jwt.token'}}))
  expect(res.status).toBe(200);expect((await res.json()).data).toEqual([tag])
  expect(transport.rpc).toHaveBeenCalledWith('tasks_api_dispatch',expect.objectContaining({p_operation:'tags.list',p_payload:{query:'urg'},p_idempotency_key:null}))
  const bad=await tags(new Request('https://omnia.test/api/v1/task-tags?limit=5',{headers:{Authorization:'Bearer browser.jwt.token'}}))
  expect(bad.status).toBe(400)
  transport.rpc.mockResolvedValue({data:{status:200,data:[{...tag,extra:1}]},error:null})
  expect((await tags(request())).status).toBe(500)
})
it('maps the catalog rejection to a typed 400 without leaking database text',async()=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.test');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','service');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','anon')
  transport.getUser.mockResolvedValue({data:{user:{id:'11111111-1111-4111-8111-111111111111'}},error:null})
  transport.rpc.mockResolvedValue({data:{status:400,error:{code:'UNKNOWN_TAG',message:'raw database text'}},error:null})
  const res=await create(new Request('https://omnia.test/api/v1/tasks',{method:'POST',headers:{Authorization:'Bearer browser.jwt.token','Content-Type':'application/json','Idempotency-Key':'k1'},body:JSON.stringify({title:'T',tags:['x']})}))
  const body=await res.json()
  expect(res.status).toBe(400);expect(body.error).toEqual({code:'UNKNOWN_TAG',message:'Tag is not in the catalog; list the valid names first'})
})
it('auth errors never forward verified identity or DB error text',async()=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.test');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','anon')
  transport.getUser.mockResolvedValue({data:{user:{id:'11111111-1111-4111-8111-111111111111'}},error:{message:'secret'}})
  const response=await tasksApiHandler(request(),'tasks.list');expect(response.status).toBe(401);expect(transport.rpc).not.toHaveBeenCalled()
})
it('all resource routes explicitly reject unauthenticated requests',async()=>{
  const empty=()=>new Request('https://omnia.test/api/v1/tasks')
  const context={params:Promise.resolve({id:'11111111-1111-4111-8111-111111111111'})}
  const responses=await Promise.all([list(empty()),create(new Request(empty(),{method:'POST'})),detail(empty(),context),patch(new Request(empty(),{method:'PATCH'}),context),statuses(empty()),tags(empty()),assignees(empty()),keys(empty()),createKey(new Request(empty(),{method:'POST'})),revoke(new Request(empty(),{method:'DELETE'}),context),exchange(new Request(empty(),{method:'POST'}))])
  expect(responses.map(r=>r.status)).toEqual(Array(11).fill(401))
})
