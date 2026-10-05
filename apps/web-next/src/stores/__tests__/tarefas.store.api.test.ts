import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTarefasStore } from '../tarefas.store'
import type { Tarefa } from '@/repositories/tarefasRepo.supabase'
const { update }=vi.hoisted(()=>({update:vi.fn()}))
vi.mock('@/repositories/tarefasRepo.supabase',()=>({tarefasRepoSupabase:{update},TasksApiError:class extends Error{}}))

beforeEach(()=>{update.mockReset();useTarefasStore.setState({tarefas:[],loading:false,error:null})})
describe('task store concurrency',()=>{
  it('passes the listed task original version to an inline edit',async()=>{
    const listed={id:'task-1',title:'Antes',wireUpdatedAt:'2026-10-04T10:00:00.123456+00:00'} as Tarefa
    useTarefasStore.setState({tarefas:[listed]})
    update.mockResolvedValue({...listed,title:'Depois'})
    await useTarefasStore.getState().updateTarefa('task-1',{title:'Depois'})
    expect(update).toHaveBeenCalledWith('task-1',{title:'Depois'},listed)
  })
})
