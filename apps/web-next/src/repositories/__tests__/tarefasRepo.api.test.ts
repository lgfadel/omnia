import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tarefasRepoSupabase, taskWritePayload, type Tarefa } from '../tarefasRepo.supabase'

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
    await tarefasRepoSupabase.create({title:'Tarefa',priority:'NORMAL',statusId:task().statusId,tags:[],isPrivate:false})
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe(fetchMock.mock.calls[1][1].headers['Idempotency-Key'])
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
