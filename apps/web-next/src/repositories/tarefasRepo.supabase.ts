import { supabase } from '@/integrations/supabase/client'
import type { Attachment, Comment, UserRef } from '@/data/types'
import { taskEtag, taskSchema, type TaskDTO, type TaskCreateDTO, type TaskPatchDTO, type TaskUserRefDTO } from '@/lib/tasksApiContracts'
import type { RecurrenceEndType, RecurrenceFrequency } from '@/lib/recurrence'

export type TarefaPrioridade = 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA'
export interface TarefaRecurrence {
  id?: string
  enabled: boolean
  frequency: RecurrenceFrequency
  interval: number
  startDate: Date
  endType: RecurrenceEndType
  endDate?: Date
  occurrenceLimit?: number
  generatedOccurrences?: number
  nextOccurrenceDate?: Date
  isActive?: boolean
}
export interface Tarefa {
  id: string
  title: string
  description?: string
  priority: TarefaPrioridade
  dueDate?: Date
  ticketOcta?: string
  ticketId?: number
  statusId: string
  assignedTo?: UserRef
  createdBy?: UserRef
  oportunidadeId?: string
  tags: string[]
  commentCount: number
  attachmentCount: number
  createdAt: Date
  updatedAt: Date
  /** Original API timestamp: PostgreSQL microseconds cannot be represented by Date. */
  wireUpdatedAt?: string
  attachments?: Attachment[]
  comments?: Comment[]
  isPrivate: boolean
  recurrenceId?: string
  recurrenceOccurrence?: number
  recurrence?: TarefaRecurrence
}

export class TasksApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message) }
}

export function localTaskDate(value: string | null | undefined): Date | undefined {
  return value ? new Date(`${value}T00:00:00`) : undefined
}
export function taskDateValue(value: Date | null | undefined): string | null {
  if (!value) return null
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const userRef = (ref: TaskDTO['assignedTo']): UserRef | undefined => ref ? {
  id: ref.id, name: ref.name, email: ref.email ?? '', roles: ref.roles as UserRef['roles'],
  avatarUrl: ref.avatarUrl ?? undefined, color: ref.color ?? undefined,
} : undefined
export function tarefaFromApi(input: TaskDTO): Tarefa {
  const task = taskSchema.parse(input)
  return {
    id:task.id,title:task.title,description:task.description ?? undefined,priority:task.priority,
    dueDate:localTaskDate(task.dueDate),ticketOcta:task.ticketOcta ?? undefined,ticketId:task.ticketId,
    statusId:task.statusId,assignedTo:userRef(task.assignedTo),createdBy:userRef(task.createdBy),
    oportunidadeId:task.oportunidadeId ?? undefined,tags:task.tags,commentCount:task.commentCount,
    attachmentCount:task.attachmentCount,createdAt:new Date(task.createdAt),updatedAt:new Date(task.updatedAt),
    wireUpdatedAt:task.updatedAt,isPrivate:task.isPrivate,recurrenceId:task.recurrenceId ?? undefined,
    recurrenceOccurrence:task.recurrenceOccurrence ?? undefined,
    recurrence:task.recurrence ? {
      id:task.recurrence.id,enabled:task.recurrence.isActive,frequency:task.recurrence.frequency,
      interval:task.recurrence.interval,startDate:localTaskDate(task.recurrence.startDate)!,
      endType:task.recurrence.endType,endDate:localTaskDate(task.recurrence.endDate),
      occurrenceLimit:task.recurrence.occurrenceLimit ?? undefined,
      generatedOccurrences:task.recurrence.generatedOccurrences,
      nextOccurrenceDate:localTaskDate(task.recurrence.nextOccurrenceDate),isActive:task.recurrence.isActive,
    } : undefined,
  }
}

export async function tasksApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.access_token) throw new TasksApiError('Sua sessão expirou. Entre novamente.',401,'INVALID_AUTH')
  const headers: Record<string,string> = {
    Authorization:`Bearer ${session.access_token}`,
    ...(init.body ? {'Content-Type':'application/json'} : {}),
    ...init.headers as Record<string,string>,
  }
  const request = () => fetch(path,{...init,headers,cache:'no-store'})
  let response: Response
  try { response = await request() }
  catch (transportError) {
    if (!(transportError instanceof TypeError) || !init.body || !new Headers(headers).get('Idempotency-Key')) throw transportError
    // Only writes with the idempotency contract can retry; keep the same key.
    response = await request()
  }
  const result = await response.json() as { data?: T; error?: {code:string;message:string} }
  if (!response.ok) {
    const message = response.status === 412
      ? 'Esta tarefa foi alterada por outra pessoa. Recarregue a página antes de salvar.'
      : result.error?.message || 'Não foi possível concluir a operação.'
    throw new TasksApiError(message,response.status,result.error?.code)
  }
  return result.data as T
}

const recurrenceInput = (recurrence: TarefaRecurrence) => ({
  frequency:recurrence.frequency,interval:recurrence.interval,startDate:taskDateValue(recurrence.startDate)!,
  endType:recurrence.endType,endDate:recurrence.endType === 'ON_DATE' ? taskDateValue(recurrence.endDate) : null,
  occurrenceLimit:recurrence.endType === 'AFTER_COUNT' ? recurrence.occurrenceLimit ?? null : null,
  isActive:recurrence.enabled,
})
const writableKeys = ['title','description','priority','dueDate','ticketOcta','statusId','assignedTo','tags','isPrivate','oportunidadeId','recurrence'] as const
export function taskWritePayload(data: Partial<Tarefa>, original?: Tarefa): TaskPatchDTO {
  const out: Record<string, unknown> = {}
  for (const key of writableKeys) {
    if (!Object.prototype.hasOwnProperty.call(data,key)) continue
    const value = data[key]
    if (key === 'recurrence') {
      const recurrence = data.recurrence
      const mapped = recurrence?.enabled ? recurrenceInput(recurrence) : null
      const before = original?.recurrence?.enabled ? recurrenceInput(original.recurrence) : null
      if ((!original && value !== undefined) || (original && (JSON.stringify(mapped) !== JSON.stringify(before) || (Boolean(mapped) && Object.keys(out).length > 0)))) out.recurrence = mapped
      continue
    }
    const targetKey = key === 'assignedTo' ? 'assignedToId' : key
    const mapped = key === 'dueDate' ? taskDateValue(value as Date | undefined)
      : key === 'assignedTo' ? (value as UserRef | undefined)?.id ?? null
      : ['description','ticketOcta','oportunidadeId'].includes(key) ? value ?? null
      : value
    const old = original?.[key]
    const oldMapped = key === 'dueDate' ? taskDateValue(old as Date | undefined)
      : key === 'assignedTo' ? (old as UserRef | undefined)?.id ?? null
      : ['description','ticketOcta','oportunidadeId'].includes(key) ? old ?? null : old
    if (!original || JSON.stringify(mapped) !== JSON.stringify(oldMapped)) out[targetKey] = mapped
  }
  return out as TaskPatchDTO
}

type TaskFilters = {statusId?:string;assignedTo?:string;priority?:TarefaPrioridade;isPrivate?:boolean;oportunidadeId?:string;query?:string;mine?:boolean}
async function listAll(filters: TaskFilters = {}): Promise<Tarefa[]> {
  const items: Tarefa[] = []
  let cursor: string | null = null
  do {
    const query = new URLSearchParams({limit:'100'})
    if (cursor) query.set('cursor',cursor)
    if (filters.statusId) query.set('statusId',filters.statusId)
    if (filters.assignedTo) query.set('assignedToId',filters.assignedTo)
    if (filters.priority) query.set('priority',filters.priority)
    if (filters.isPrivate !== undefined) query.set('isPrivate',String(filters.isPrivate))
    if (filters.oportunidadeId) query.set('oportunidadeId',filters.oportunidadeId)
    if (filters.query) query.set('query',filters.query)
    if (filters.mine) query.set('mine','true')
    const page = await tasksApiRequest<{items:TaskDTO[];nextCursor:string|null}>(`/api/v1/tasks?${query}`)
    items.push(...page.items.map(tarefaFromApi))
    cursor = page.nextCursor
  } while (cursor)
  // The cursor API already orders by the full PostgreSQL timestamp and ID.
  // Re-sorting Date values would collapse microseconds and change that order.
  return items
}

export const tarefasRepoSupabase = {
  list:listAll,
  async get(id:string): Promise<Tarefa | null> {
    try { return tarefaFromApi(await tasksApiRequest<TaskDTO>(`/api/v1/tasks/${encodeURIComponent(id)}`)) }
    catch (error) { if (error instanceof TasksApiError && error.status === 404) return null; throw error }
  },
  async create(data: Omit<Tarefa,'id'|'createdAt'|'updatedAt'|'commentCount'|'attachmentCount'>): Promise<Tarefa> {
    const body = taskWritePayload(data) as TaskCreateDTO
    body.title = data.title
    return tarefaFromApi(await tasksApiRequest<TaskDTO>('/api/v1/tasks',{
      method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body),
    }))
  },
  async update(id:string,data:Partial<Omit<Tarefa,'id'|'createdAt'>>,original?:Tarefa): Promise<Tarefa | null> {
    const basis = original ?? await this.get(id)
    if (!basis) return null
    const body = taskWritePayload(data,basis)
    if (Object.keys(body).length === 0) return basis
    if (!basis.wireUpdatedAt) throw new TasksApiError('Recarregue a tarefa antes de salvar.',428,'PRECONDITION_REQUIRED')
    return tarefaFromApi(await tasksApiRequest<TaskDTO>(`/api/v1/tasks/${encodeURIComponent(id)}`,{
      method:'PATCH',headers:{'If-Match':taskEtag(basis.wireUpdatedAt),'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body),
    }))
  },
  // Deletion has no v1 API route and retains its existing authorized Supabase path.
  async remove(id:string):Promise<boolean> {
    const {error} = await supabase.from('omnia_tickets').delete().eq('id',id)
    if (error) throw error
    return true
  },
  getMyTasks:(_userId:string) => listAll({mine:true}),
  search:(query:string) => {
    const trimmed = query.trim()
    if (!trimmed) return Promise.resolve([])
    const searchQuery = /^#\d+$/.test(trimmed) ? BigInt(trimmed.slice(1)).toString() : trimmed
    return listAll({query:searchQuery})
  },
}

export async function listTaskAssignees(query?: string): Promise<UserRef[]> {
  const params = new URLSearchParams({limit:'100'})
  if (query?.trim()) params.set('query',query.trim())
  const refs = await tasksApiRequest<TaskUserRefDTO[]>(`/api/v1/task-assignees?${params}`)
  return refs.map(ref => userRef(ref)!)
}
