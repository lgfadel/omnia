import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTarefasStore } from '../tarefas.store'
import type { Tarefa } from '@/repositories/tarefasRepo.supabase'
const { update, list }=vi.hoisted(()=>({update:vi.fn(), list:vi.fn()}))
vi.mock('@/repositories/tarefasRepo.supabase',()=>({tarefasRepoSupabase:{update,list},TasksApiError:class extends Error{}}))

beforeEach(()=>{update.mockReset();list.mockReset();useTarefasStore.setState({tarefas:[],loading:false,error:null,hasLoadedTarefas:false})})
describe('task store concurrency',()=>{
  it('passes the listed task original version to an inline edit',async()=>{
    const listed={id:'task-1',title:'Antes',wireUpdatedAt:'2026-10-04T10:00:00.123456+00:00'} as Tarefa
    useTarefasStore.setState({tarefas:[listed]})
    update.mockResolvedValue({...listed,title:'Depois'})
    await useTarefasStore.getState().updateTarefa('task-1',{title:'Depois'})
    expect(update).toHaveBeenCalledWith('task-1',{title:'Depois'},listed)
  })
})

describe('task list loading', () => {
  it('keeps an empty list marked as loaded during a background refresh', async () => {
    list.mockResolvedValueOnce([])
    await useTarefasStore.getState().loadTarefas()
    expect(useTarefasStore.getState().hasLoadedTarefas).toBe(true)

    let finish!: (tasks: Tarefa[]) => void
    list.mockReturnValueOnce(new Promise<Tarefa[]>(resolve => { finish = resolve }))
    const refresh = useTarefasStore.getState().loadTarefas()
    expect(useTarefasStore.getState().hasLoadedTarefas).toBe(true)
    finish([])
    await refresh
  })

  it('keeps the loaded list available while an edit is being saved', async () => {
    const task = { id: 'task-1', title: 'Antes' } as Tarefa
    list.mockResolvedValueOnce([task])
    await useTarefasStore.getState().loadTarefas()
    let finish!: (task: Tarefa) => void
    update.mockReturnValueOnce(new Promise<Tarefa>(resolve => { finish = resolve }))
    const save = useTarefasStore.getState().updateTarefa(task.id, { title: 'Depois' })
    expect(useTarefasStore.getState().hasLoadedTarefas).toBe(true)
    expect(useTarefasStore.getState().tarefas).toEqual([task])
    finish({ ...task, title: 'Depois' })
    await save
    expect(useTarefasStore.getState().tarefas[0].title).toBe('Depois')
  })
})
