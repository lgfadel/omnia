import { z } from 'zod'

export const taskPrioritySchema = z.enum(['URGENTE', 'ALTA', 'NORMAL', 'BAIXA'])
export const taskScopeSchema = z.enum(['tasks:read', 'tasks:create', 'tasks:update', 'tasks:comment'])
export const taskDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}, 'Invalid calendar date')
// Keep the original database string: Date serialization would discard microseconds.
export const taskTimestampSchema = z.string().datetime({ offset: true }).refine(value => taskDateSchema.safeParse(value.slice(0, 10)).success)
const uuid = z.string().uuid()
const tags = z.array(z.string().max(100)).max(50)
export const taskRecurrenceInputSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  interval: z.number().int().min(1).max(365).optional(),
  startDate: taskDateSchema,
  endType: z.enum(['NEVER', 'ON_DATE', 'AFTER_COUNT']).optional(),
  endDate: taskDateSchema.nullable().optional(),
  occurrenceLimit: z.number().int().positive().max(2147483647).nullable().optional(),
  isActive: z.boolean().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.endType === 'ON_DATE' && (!value.endDate || value.endDate < value.startDate)) ctx.addIssue({code:'custom',message:'Invalid recurrence end date'})
  if (value.endType === 'AFTER_COUNT' && !value.occurrenceLimit) ctx.addIssue({code:'custom',message:'Occurrence limit required'})
})
const writable = {
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(50000).nullable().optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: taskDateSchema.nullable().optional(),
  ticketOcta: z.string().max(500).nullable().optional(),
  statusId: uuid.optional(),
  assignedToId: uuid.nullable().optional(),
  tags: tags.optional(),
  isPrivate: z.boolean().optional(),
  oportunidadeId: uuid.nullable().optional(),
  recurrence: taskRecurrenceInputSchema.nullable().optional(),
}
export const taskCreateSchema = z.object({...writable,title:z.string().trim().min(1).max(500)}).strict()
export const taskPatchSchema = z.object(writable).strict().refine(value => Object.keys(value).length > 0, 'Patch requires a field')
const queryBoolean = z.enum(['true','false']).transform(value => value === 'true')
const queryLimit = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100))
export const taskCursorSchema = z.object({createdAt:taskTimestampSchema,id:uuid}).strict()
export const taskListQuerySchema = z.object({
  limit: queryLimit.optional().default('50'),
  cursor: z.string().min(1).max(1000).optional(),
  query: z.string().max(500).optional(),
  statusId: uuid.optional(), assignedToId: uuid.optional(), mine: queryBoolean.optional(),
  priority:taskPrioritySchema.optional(), isPrivate:queryBoolean.optional(), oportunidadeId:uuid.optional(),
  tags: z.string().max(10000).transform(value => JSON.parse(value) as unknown).pipe(tags).optional(),
  dueDateFrom:taskDateSchema.optional(),dueDateTo:taskDateSchema.optional(),
}).strict().refine(value => !value.dueDateFrom || !value.dueDateTo || value.dueDateFrom <= value.dueDateTo, 'Invalid date range')
export const taskTagQuerySchema = z.object({query:z.string().max(500).optional()}).strict()
export const taskAssigneeQuerySchema = z.object({query:z.string().max(500).optional(),limit:queryLimit.optional().default('50')}).strict()
export const credentialCreateSchema = z.object({
  name:z.string().trim().min(1).max(100), audience:z.enum(['api','mcp']),
  scopes:z.array(taskScopeSchema).min(1).max(4).refine(value => new Set(value).size === value.length),
  // Omitted keeps the 90-day default; an explicit null creates a key that never expires.
  expiresAt:taskTimestampSchema.nullable().optional(),
}).strict()
const commentBody = z.string().trim().min(1).max(10000)
export const commentCreateSchema = z.object({body:commentBody}).strict()
export const commentUpdateSchema = z.object({body:commentBody}).strict()
export const commentListQuerySchema = z.object({limit:queryLimit.optional().default('50'),cursor:z.string().min(1).max(1000).optional()}).strict()
export const mcpExchangeSchema = z.object({mcpKey:z.string().max(100)}).strict()
export const taskUserRefSchema = z.object({id:uuid,name:z.string(),email:z.string().nullable(),roles:z.array(z.string()).nullable().transform(value => value ?? []),avatarUrl:z.string().nullable(),color:z.string().nullable()}).strict()
export const taskRecurrenceSchema = z.object({
  id:uuid,templateTicketId:uuid.nullable(),frequency:z.enum(['DAILY','WEEKLY','MONTHLY']),interval:z.number().int(),startDate:taskDateSchema,
  endType:z.enum(['NEVER','ON_DATE','AFTER_COUNT']),endDate:taskDateSchema.nullable(),occurrenceLimit:z.number().int().nullable(),
  generatedOccurrences:z.number().int(),nextOccurrenceDate:taskDateSchema.nullable(),isActive:z.boolean(),
}).strict()
export const taskSchema = z.object({
  id:uuid,ticketId:z.number().int(),ticketOcta:z.string().nullable(),title:z.string(),description:z.string().nullable(),priority:taskPrioritySchema,
  dueDate:taskDateSchema.nullable(),statusId:uuid,assignedToId:uuid.nullable(),createdById:uuid.nullable(),tags:z.array(z.string()),isPrivate:z.boolean(),
  oportunidadeId:uuid.nullable(),commentCount:z.number().int(),attachmentCount:z.number().int(),recurrenceId:uuid.nullable(),recurrenceOccurrence:z.number().int().nullable(),
  createdAt:taskTimestampSchema,updatedAt:taskTimestampSchema,assignedTo:taskUserRefSchema.nullable(),createdBy:taskUserRefSchema.nullable(),recurrence:taskRecurrenceSchema.nullable(),
}).strict()
export const commentSchema = z.object({id:uuid,taskId:uuid,body:z.string(),authorId:uuid,author:taskUserRefSchema.nullable(),createdAt:taskTimestampSchema}).strict()
export const taskStatusSchema = z.object({id:uuid,name:z.string(),color:z.string().nullable(),order:z.number().int(),isDefault:z.boolean().nullable().transform(value => value ?? false),isFinal:z.boolean()}).strict()
export const taskTagSchema = z.object({id:uuid,name:z.string(),color:z.string()}).strict()
export const credentialSchema = z.object({id:uuid,name:z.string(),audience:z.enum(['api','mcp']),scopes:z.array(taskScopeSchema),createdAt:taskTimestampSchema,expiresAt:taskTimestampSchema.nullable(),revokedAt:taskTimestampSchema.nullable(),lastUsedAt:taskTimestampSchema.nullable()}).strict()
export const mcpCapabilitySchema = z.object({id:uuid,audience:z.literal('api'),scopes:z.array(taskScopeSchema),expiresAt:taskTimestampSchema}).strict()
export type TaskDTO = z.infer<typeof taskSchema>
export type TaskCreateDTO = z.infer<typeof taskCreateSchema>
export type TaskPatchDTO = z.infer<typeof taskPatchSchema>
export type TaskListQueryDTO = z.infer<typeof taskListQuerySchema>
export type TaskUserRefDTO = z.infer<typeof taskUserRefSchema>
export type CommentDTO = z.infer<typeof commentSchema>
export type CommentCreateDTO = z.infer<typeof commentCreateSchema>
export type CommentUpdateDTO = z.infer<typeof commentUpdateSchema>
export type TaskStatusDTO = z.infer<typeof taskStatusSchema>
export type TaskTagDTO = z.infer<typeof taskTagSchema>
export type IntegrationCredentialDTO = z.infer<typeof credentialSchema>
export type IntegrationCredentialCreateDTO = z.infer<typeof credentialCreateSchema>
export type McpCapabilityDTO = z.infer<typeof mcpCapabilitySchema>
export type TasksApiSuccess<T> = {data:T;requestId:string}
export type TasksApiFailure = {error:{code:string;message:string};requestId:string}

/** Strong validator shared by browser adapters and the API; preserves database precision. */
export function taskEtag(updatedAt: string): string {
  taskTimestampSchema.parse(updatedAt)
  return '"' + btoa(updatedAt).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '"'
}
export function taskUpdatedAtFromEtag(etag: string): string {
  if (!/^"[A-Za-z0-9_-]+"$/.test(etag) || etag.length > 200) throw new Error('Invalid strong ETag')
  const encoded = etag.slice(1, -1)
  const value = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
  taskTimestampSchema.parse(value)
  if (taskEtag(value) !== etag) throw new Error('Noncanonical ETag')
  return value
}
