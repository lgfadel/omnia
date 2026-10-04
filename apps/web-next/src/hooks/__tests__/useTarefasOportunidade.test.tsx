import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTarefasOportunidade } from '../useTarefasOportunidade'

const { list, request } = vi.hoisted(()=>({list:vi.fn(),request:vi.fn()}))
vi.mock('@/repositories/tarefasRepo.supabase',()=>({tarefasRepoSupabase:{list},tasksApiRequest:request}))
beforeEach(()=>{list.mockReset();request.mockReset()})
describe('linked opportunity tasks',()=>{
  it('uses opportunity-filtered official API tasks and dynamic status UUID metadata', async()=>{
    list.mockResolvedValue([{id:'task',title:'Ligar',statusId:'status-uuid',priority:'NORMAL',createdAt:new Date(),dueDate:undefined,assignedTo:undefined}])
    request.mockResolvedValue([{id:'status-uuid',name:'Em análise',color:'#1f2937',order:1,isDefault:false,isFinal:false}])
    const {result}=renderHook(()=>useTarefasOportunidade('opportunity-uuid'))
    await waitFor(()=>expect(result.current.loading).toBe(false))
    expect(list).toHaveBeenCalledWith({oportunidadeId:'opportunity-uuid'})
    expect(result.current.tarefas[0]).toMatchObject({status:'status-uuid',statusLabel:'Em análise',statusColor:'#1f2937'})
  })
})
