import { useCallback, useEffect, useState } from 'react'
import { tarefasRepoSupabase, tasksApiRequest } from '@/repositories/tarefasRepo.supabase'
import type { TaskStatusDTO } from '@/lib/tasksApiContracts'

export interface TarefaOportunidade {
  id:string
  title:string
  dueDate?:Date
  status:string
  statusColor:string
  statusLabel:string
  assignedTo?:{id:string;name:string;email:string;avatarUrl?:string;color?:string}
  priority:'URGENTE'|'ALTA'|'NORMAL'|'BAIXA'
  createdAt:Date
}

export function useTarefasOportunidade(oportunidadeId:string) {
  const [tarefas,setTarefas]=useState<TarefaOportunidade[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const fetchTarefas=useCallback(async()=>{
    if (!oportunidadeId) {setTarefas([]);setLoading(false);return}
    setLoading(true);setError(null)
    try {
      const [tasks,statuses]=await Promise.all([
        tarefasRepoSupabase.list({oportunidadeId}),
        tasksApiRequest<TaskStatusDTO[]>('/api/v1/task-statuses'),
      ])
      const byId=new Map(statuses.map(status=>[status.id,status]))
      setTarefas(tasks.map(task=>{
        const status=byId.get(task.statusId)
        return {
          id:task.id,title:task.title,dueDate:task.dueDate,status:task.statusId,
          statusColor:status?.color || '#6b7280',statusLabel:status?.name || 'Status indisponível',
          assignedTo:task.assignedTo ? {id:task.assignedTo.id,name:task.assignedTo.name,email:task.assignedTo.email,
            avatarUrl:task.assignedTo.avatarUrl,color:task.assignedTo.color} : undefined,
          priority:task.priority,createdAt:task.createdAt,
        }
      }))
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Erro ao carregar tarefas')}
    finally {setLoading(false)}
  },[oportunidadeId])
  useEffect(()=>{void fetchTarefas()},[fetchTarefas])
  return {tarefas,loading,error,refetch:fetchTarefas}
}
