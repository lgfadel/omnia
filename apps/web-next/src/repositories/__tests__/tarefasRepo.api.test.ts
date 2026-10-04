import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tarefasRepoSupabase, taskWritePayload, type Tarefa } from '../tarefasRepo.supabase'
import { integrationKeysRepo } from '../integrationKeysRepo.api'

const { getSession } = vi.hoisted(() => ({getSession:vi.fn()}))
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession }, from: vi.fn() } }))

const task = (overrides: Record<string, unknown> = {}) => ({
  id:'11111111-1111-4111-8111-111111111111', ticketId:14,ticketOcta:null,title:'Tarefa',description:null,priority:'NORMAL',dueDate:'2026-10-04',
  statusId:'22222222-2222-4222-8222-222222222222',assignedToId:null,createdById:null,tags:['x'],isPrivate:false,oportunidadeId:null,
  commentCount:2,attachmentCount:1,recurrenceId:null,recurrenceOccurrence:null,createdAt:'2026-10-04T10:00:00.000000+00:00',
  updatedAt:'2026-10-04T10:00:00.123456+00:00',assignedTo:null,createdBy:null,recurrence:null,...overrides,
})
const json = (data: unknown) => new Response(JSON.stringify({data,requestId:'req'}), {status:200,headers:{'Content-Type':'application/json'}})
const fetchMock = vi.fn()

beforeEach(() => {
  getSession.mockResolvedValue({data:{session:{access_token:'browser-jwt'}},error:null})
  fetchMock.mockReset()
  vi.stubGlobal('fetch',fetchMock)
})

describe('official task adapter', () => {
  it('loads every cursor page and preserves local calendar dates, refs and wire precision', async () => {
    fetchMock.mockResolvedValueOnce(json({items:[task()],nextCursor:'opaque'})).mockResolvedValueOnce(json({items:[task({id:'33333333-3333-4333-8333-333333333333',createdAt:'2026-10-03T10:00:00.000000+00:00',assignedTo:{id:'44444444-4444-4444-8444-444444444444',name:'Ana',email:null,roles:[],avatarUrl:null,color:null}})],nextCursor:null}))
    const items = await tarefasRepoSupabase.list()
    expect(items).toHaveLength(2)
    expect(fetchMock.mock.calls[1][0]).toContain('cursor=opaque')
    expect(items[0].dueDate?.getDate()).toBe(4)
    expect(items[0].wireUpdatedAt).toBe('2026-10-04T10:00:00.123456+00:00')
    expect(items[1].assignedTo?.roles).toEqual([])
  })

  it('keeps API cursor order when creation times differ only in microseconds', async () => {
    const earlierId = '11111111-1111-4111-8111-111111111111'
    const laterId = '99999999-9999-4999-8999-999999999999'
    fetchMock.mockResolvedValueOnce(json({
      items:[task({id:earlierId,createdAt:'2026-10-04T10:00:00.123456+00:00'})],
      nextCursor:'after-first',
    })).mockResolvedValueOnce(json({
      items:[task({id:laterId,createdAt:'2026-10-04T10:00:00.123123+00:00'})],
      nextCursor:null,
    }))

    expect((await tarefasRepoSupabase.list()).map(item => item.id)).toEqual([earlierId,laterId])
  })

  it('searches a leading hash ticket number with its canonical numeric API query', async () => {
    fetchMock.mockResolvedValueOnce(json({items:[],nextCursor:null}))
    await tarefasRepoSupabase.search('#00123')
    expect(new URL(fetchMock.mock.calls[0][0],'http://localhost').searchParams.get('query')).toBe('123')
  })

  it('sends only changed recurrence config, keeping completed status out of the patch and exact If-Match', async () => {
    fetchMock.mockResolvedValueOnce(json(task({recurrence:{id:'55555555-5555-4555-8555-555555555555',templateTicketId:null,frequency:'WEEKLY',interval:1,startDate:'2026-10-04',endType:'NEVER',endDate:null,occurrenceLimit:null,generatedOccurrences:3,nextOccurrenceDate:'2026-10-25',isActive:true}})))
    const original = await tarefasRepoSupabase.get(task().id) as Tarefa
    fetchMock.mockResolvedValueOnce(json(task()))
    await tarefasRepoSupabase.update(original.id,{...original,recurrence:{...original.recurrence!,interval:2}},original)
    const [,init] = fetchMock.mock.calls[1]
    expect(init.headers['If-Match']).toBe('"MjAyNi0xMC0wNFQxMDowMDowMC4xMjM0NTYrMDA6MDA"')
    expect(JSON.parse(init.body)).toEqual({recurrence:{frequency:'WEEKLY',interval:2,startDate:'2026-10-04',endType:'NEVER',endDate:null,occurrenceLimit:null,isActive:true}})
  })

  it('keeps series form edits connected to its future template without copying completed status', () => {
    const original = {title:'Antigo',statusId:'completed',recurrence:{enabled:true,frequency:'WEEKLY',interval:1,startDate:new Date('2026-10-04T00:00:00'),endType:'NEVER'}} as Tarefa
    expect(taskWritePayload({title:'Novo',statusId:'completed',recurrence:original.recurrence},original)).toMatchObject({title:'Novo',recurrence:{frequency:'WEEKLY'}})
    expect(taskWritePayload({title:'Novo',statusId:'completed',recurrence:original.recurrence},original)).not.toHaveProperty('statusId')
  })

  it('reuses one idempotency key on a transport retry', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(json(task()))
    const created = await tarefasRepoSupabase.create({title:'Tarefa',priority:'NORMAL',statusId:task().statusId,tags:[],isPrivate:false})
    expect(created.id).toBe(task().id)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBeTruthy()
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe(fetchMock.mock.calls[1][1].headers['Idempotency-Key'])
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body)
  })

  it('retries a task update with the same key, body and exact version', async () => {
    fetchMock.mockResolvedValueOnce(json(task()))
    const original = await tarefasRepoSupabase.get(task().id) as Tarefa
    fetchMock.mockRejectedValueOnce(new TypeError('response lost')).mockResolvedValueOnce(json(task({title:'Edited'})))
    const updated = await tarefasRepoSupabase.update(original.id,{title:'Edited'},original)
    expect(updated?.title).toBe('Edited')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const first = fetchMock.mock.calls[1][1]
    const retry = fetchMock.mock.calls[2][1]
    expect(first.headers['Idempotency-Key']).toBeTruthy()
    expect(retry.headers['Idempotency-Key']).toBe(first.headers['Idempotency-Key'])
    expect(retry.headers['If-Match']).toBe(first.headers['If-Match'])
    expect(retry.body).toBe(first.body)
  })

  it('does not repeat non-idempotent key issuance when its response is lost', async () => {
    const lostResponse = new TypeError('response lost after issuance')
    fetchMock.mockRejectedValueOnce(lostResponse).mockResolvedValueOnce(json({token:'unexpected-second-key'}))
    await expect(integrationKeysRepo.create({name:'Automation',audience:'api',scopes:['tasks:read']})).rejects.toBe(lostResponse)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/integration-keys')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })

  it('sends explicit null clears and an idempotency key', async () => {
    fetchMock.mockResolvedValueOnce(json(task({description:'Antes'})))
    const original = await tarefasRepoSupabase.get(task().id) as Tarefa
    fetchMock.mockResolvedValueOnce(json(task()))
    await tarefasRepoSupabase.update(task().id,{description:undefined,dueDate:undefined},original)
    const [,init] = fetchMock.mock.calls[1]
    expect(JSON.parse(init.body)).toEqual({description:null,dueDate:null})
    expect(init.headers['Idempotency-Key']).toBeTruthy()
  })
})
