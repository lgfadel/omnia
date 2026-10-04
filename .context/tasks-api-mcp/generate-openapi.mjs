import { writeFileSync } from 'node:fs'

// Task 5 documentation artifact generator. Source contracts: tasksApiContracts.ts,
// tasksApiService.ts, and the four implementation reports in this directory.
const ref = name => ({ $ref: `#/components/schemas/${name}` })
const string = (extra = {}) => ({ type: 'string', ...extra })
const uuid = string({ format: 'uuid' })
const date = string({ format: 'date', description: 'Calendar date in YYYY-MM-DD.' })
const timestamp = string({ format: 'date-time', description: 'Offset timestamp; preserve the original fractional seconds (including microseconds).' })
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] })
const array = (items, extra = {}) => ({ type: 'array', items, ...extra })
const object = (properties, required = [], extra = {}) => ({ type: 'object', properties, required, additionalProperties: false, ...extra })
const response = (schema, description = 'Success') => ({ description, headers: { 'X-Request-Id': { schema: uuid }, 'Cache-Control': { schema: string(), description: 'Always no-store.' } }, content: { 'application/json': { schema: object({ data: schema, requestId: uuid }, ['data', 'requestId']) } } })
const errorResponse = description => ({ description, headers: { 'X-Request-Id': { schema: uuid }, 'Cache-Control': { schema: string(), description: 'Always no-store.' } }, content: { 'application/json': { schema: ref('Failure') } } })
const errors = Object.fromEntries([['400','Malformed or invalid input'],['401','Invalid or absent bearer'],['403','Actor, audience, scope, or task permission denied'],['404','Task or credential not visible or found'],['409','Conflict or changed idempotency payload'],['412','Stale task version'],['413','JSON body exceeds 64 KiB'],['415','JSON Content-Type required'],['428','If-Match required'],['429','120 task resource/exchange requests per actor per minute'],['500','Sanitized internal error'],['503','Integration operation disabled']].map(([code, description]) => [code, errorResponse(description)]))
errors['429'].headers['Retry-After'] = { schema: string({ const: '60' }) }
const listErrors = (...codes) => Object.fromEntries(codes.map(code => [code, errors[code]]))
const bearer = [{ browserBearer: [] }, { apiKeyBearer: [] }, { mcpCapabilityBearer: [] }]
const browser = [{ browserBearer: [] }]
const query = (name, schema, description) => ({ name, in: 'query', required: false, schema, ...(description ? { description } : {}) })
const id = { name: 'id', in: 'path', required: true, schema: uuid }
const jsonBody = schema => ({ required: true, content: { 'application/json': { schema } } })
const requestId = { name: 'X-Request-Id', in: 'header', required: false, description: 'Valid UUID is echoed; otherwise the server assigns one.', schema: uuid }
const idempotency = { name: 'Idempotency-Key', in: 'header', required: true, description: 'Printable ASCII, 1–200 characters, without a comma. Reuse only for an identical write by the same principal and operation.', schema: string({ minLength: 1, maxLength: 200, pattern: '^[!-+--~]+$' }) }
const ifMatch = { name: 'If-Match', in: 'header', required: true, description: 'Exact strong ETag returned by GET/POST/PATCH, preserving the database updatedAt string. No wildcard or weak ETag.', schema: string({ pattern: '^"[A-Za-z0-9_-]+"$' }) }
const etagHeader = { ETag: { description: 'Strong version derived from the exact updatedAt timestamp.', schema: string({ pattern: '^"[A-Za-z0-9_-]+"$' }) } }
const writable = {
  title: string({ minLength: 1, maxLength: 500, description: 'Leading and trailing whitespace is trimmed before validation; an empty result is rejected, then the 500-character limit applies.' }), description: nullable(string({ maxLength: 50000 })),
  priority: ref('Priority'), dueDate: nullable(date), ticketOcta: nullable(string({ maxLength: 500 })), statusId: uuid,
  assignedToId: nullable(uuid), tags: array(string({ maxLength: 100 }), { maxItems: 50 }), isPrivate: { type: 'boolean' },
  oportunidadeId: nullable(uuid), recurrence: nullable(ref('RecurrenceInput')),
}
const credentialProperties = { id: uuid, name: string(), audience: string({ enum: ['api','mcp'] }), scopes: array(ref('Scope')), createdAt: timestamp, expiresAt: timestamp, revokedAt: nullable(timestamp), lastUsedAt: nullable(timestamp) }
const userProperties = { id: uuid, name: string(), email: nullable(string()), roles: array(string()), avatarUrl: nullable(string()), color: nullable(string()) }
const taskProperties = {
  id: uuid, ticketId: { type: 'integer', description: 'Generated public sequential ticket number; distinct from ticketOcta.' },
  ticketOcta: nullable(string({ description: 'Optional external Octa reference; not the generated public ticketId.' })),
  title: string(), description: nullable(string()), priority: ref('Priority'), dueDate: nullable(date), statusId: uuid,
  assignedToId: nullable(uuid), createdById: nullable(uuid), tags: array(string()), isPrivate: { type: 'boolean' },
  oportunidadeId: nullable(uuid), commentCount: { type: 'integer' }, attachmentCount: { type: 'integer' },
  recurrenceId: nullable(uuid), recurrenceOccurrence: nullable({ type: 'integer' }), createdAt: timestamp, updatedAt: timestamp,
  assignedTo: nullable(ref('UserRef')), createdBy: nullable(ref('UserRef')), recurrence: nullable(ref('Recurrence')),
}
const spec = {
  openapi: '3.1.0',
  info: { title: 'Omnia Tasks API', version: '1.0.0', description: 'Implemented /api/v1 task and personal integration-key routes. Integration read/write switches default closed. Responses processed by implemented handlers use no-store and an X-Request-Id; unsupported verbs can receive the Next.js framework default 405 response.' },
  servers: [{ url: 'https://{omniaHost}', variables: { omniaHost: { default: 'omnia.example.com', description: 'Replace with the deployed Omnia API hostname.' } } }],
  tags: [{ name: 'Tasks', description: 'Read, create, and conditionally update tasks.' }, { name: 'References', description: 'Read status and eligible assignee references.' }, { name: 'Integration keys', description: 'Manage personal keys with a verified browser session.' }, { name: 'MCP exchange', description: 'Backend-only exchange of MCP keys for short-lived API capabilities.' }],
  components: {
    securitySchemes: {
      browserBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'verified Supabase user JWT', description: 'Required for key management; accepted on task resources.' },
      apiKeyBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'omnia_api_', description: 'Personal direct API key; live user permissions and scopes apply.' },
      mcpCapabilityBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'omnia_cap_', description: 'Short-lived API-only session returned by backend MCP exchange; its parent MCP key remains checked.' },
      mcpExchangeSecretBearer: { type: 'http', scheme: 'bearer', description: 'Backend-only OMNIA_MCP_EXCHANGE_SECRET. Never send this from a browser or bot chat.' },
    },
    schemas: {
      Failure: object({ error: object({ code: string({ enum: ['INVALID_OPERATION','INVALID_AUTH','INVALID_CREDENTIAL','ACTOR_DISABLED','INVALID_AUDIENCE','FORBIDDEN','INSUFFICIENT_SCOPE','VALIDATION_ERROR','NOT_FOUND','CONFLICT','IDEMPOTENCY_CONFLICT','PRECONDITION_REQUIRED','PRECONDITION_FAILED','RATE_LIMITED','INTEGRATIONS_DISABLED','PAYLOAD_TOO_LARGE','UNSUPPORTED_MEDIA_TYPE','METHOD_NOT_ALLOWED','INTERNAL_ERROR'] }), message: string() }, ['code','message']), requestId: uuid }, ['error','requestId']),
      Priority: string({ enum: ['URGENTE','ALTA','NORMAL','BAIXA'] }), Scope: string({ enum: ['tasks:read','tasks:create','tasks:update'] }),
      UserRef: object(userProperties, Object.keys(userProperties)),
      Status: object({ id: uuid, name: string(), color: nullable(string()), order: { type: 'integer' }, isDefault: { type: 'boolean' }, isFinal: { type: 'boolean' } }, ['id','name','color','order','isDefault','isFinal']),
      RecurrenceInput: object({ frequency: string({ enum: ['DAILY','WEEKLY','MONTHLY'] }), interval: { type: 'integer', minimum: 1, maximum: 365, default: 1 }, startDate: date, endType: string({ enum: ['NEVER','ON_DATE','AFTER_COUNT'], default: 'NEVER' }), endDate: nullable(date), occurrenceLimit: nullable({ type: 'integer', minimum: 1, maximum: 2147483647 }), isActive: { type: 'boolean' } }, ['frequency','startDate'], { description: 'Browser-user writes only. ON_DATE requires endDate >= startDate; AFTER_COUNT requires a positive occurrenceLimit. Integration tokens cannot send this field, even null.' }),
      Recurrence: object({ id: uuid, templateTicketId: nullable(uuid), frequency: string({ enum: ['DAILY','WEEKLY','MONTHLY'] }), interval: { type: 'integer' }, startDate: date, endType: string({ enum: ['NEVER','ON_DATE','AFTER_COUNT'] }), endDate: nullable(date), occurrenceLimit: nullable({ type: 'integer' }), generatedOccurrences: { type: 'integer' }, nextOccurrenceDate: nullable(date), isActive: { type: 'boolean' } }, ['id','templateTicketId','frequency','interval','startDate','endType','endDate','occurrenceLimit','generatedOccurrences','nextOccurrenceDate','isActive']),
      Task: object(taskProperties, Object.keys(taskProperties)),
      TaskCreate: object(writable, ['title'], { description: 'Standalone for API/MCP keys. Recurrence is accepted only for a verified browser user. A non-null recurrence sets the first task dueDate to recurrence.startDate, overriding any supplied dueDate. If the next slot exceeds ON_DATE or AFTER_COUNT bounds, the series starts inactive with nextOccurrenceDate:null. Standalone creation preserves the supplied dueDate.' }),
      TaskPatch: object(writable, [], { minProperties: 1, description: 'At least one writable field. recurrence:null stops a human-managed series; integration tokens cannot send recurrence at all.' }),
      TaskPage: object({ items: array(ref('Task')), nextCursor: nullable(string({ description: 'Opaque base64url cursor; forward unchanged on the next request.' })) }, ['items','nextCursor']),
      Credential: object(credentialProperties, Object.keys(credentialProperties)),
      CredentialIssued: object({ ...credentialProperties, token: string({ description: 'One-time raw omnia_api_ or omnia_mcp_ secret; not available from list or revoke.' }) }, [...Object.keys(credentialProperties),'token']),
      CredentialCreate: object({ name: string({ minLength: 1, maxLength: 100, description: 'Leading and trailing whitespace is trimmed before validation; an empty result is rejected, then the 100-character limit applies.' }), audience: string({ enum: ['api','mcp'] }), scopes: array(ref('Scope'), { minItems: 1, maxItems: 3, uniqueItems: true }), expiresAt: timestamp }, ['name','audience','scopes'], { description: 'Expiration defaults to 90 days; explicit future time must be at most 365 days away.' }),
      ExchangeRequest: object({ mcpKey: string({ maxLength: 100, description: 'One-time-issued omnia_mcp_ key. Exchange requires a separate backend service bearer.' }) }, ['mcpKey']),
      CapabilityIssued: object({ id: uuid, audience: string({ const: 'api' }), scopes: array(ref('Scope')), expiresAt: timestamp, token: string({ description: 'One-time omnia_cap_ value valid for at most 15 minutes and no later than its parent.' }) }, ['id','audience','scopes','expiresAt','token']),
    },
  },
  paths: {
    '/api/v1/tasks': {
      get: { tags: ['Tasks'], operationId: 'listTasks', summary: 'List visible tasks', description: 'Descending (createdAt,id) cursor order. mine=true filters assigned tasks for the verified domain user; it does not grant access. Query searches title, description, ticketOcta, or an exact ticketId; tags require all supplied tags. Due-date bounds are inclusive.', security: bearer, parameters: [requestId,query('limit',{ type: 'integer', minimum: 1, maximum: 100, default: 50 }),query('cursor',string({ maxLength: 1000 }),'Opaque nextCursor from the previous page.'),query('query',string({ maxLength: 500 })),query('statusId',uuid),query('assignedToId',uuid),query('mine',{ type: 'boolean' }),query('priority',ref('Priority')),query('isPrivate',{ type: 'boolean' }),query('oportunidadeId',uuid),query('tags',string({ description: 'JSON-encoded array of up to 50 tags; each at most 100 characters.' })),query('dueDateFrom',date),query('dueDateTo',date)], responses: { '200': response(ref('TaskPage')), ...listErrors('400','401','403','429','500','503') } },
      post: { tags: ['Tasks'], operationId: 'createTask', summary: 'Create a task', security: bearer, parameters: [requestId,idempotency], requestBody: jsonBody(ref('TaskCreate')), responses: { '201': { ...response(ref('Task'),'Created'), headers: { ...response(ref('Task')).headers, ...etagHeader } }, ...listErrors('400','401','403','409','413','415','429','500','503') } },
    },
    '/api/v1/tasks/{id}': {
      get: { tags: ['Tasks'], operationId: 'getTask', summary: 'Get a visible task', security: bearer, parameters: [id,requestId], responses: { '200': { ...response(ref('Task')), headers: { ...response(ref('Task')).headers, ...etagHeader } }, ...listErrors('400','401','403','404','429','500','503') } },
      patch: { tags: ['Tasks'], operationId: 'updateTask', summary: 'Update a task conditionally', security: bearer, parameters: [id,requestId,ifMatch,idempotency], requestBody: jsonBody(ref('TaskPatch')), responses: { '200': { ...response(ref('Task')), headers: { ...response(ref('Task')).headers, ...etagHeader } }, ...listErrors('400','401','403','404','409','412','413','415','428','429','500','503') } },
    },
    '/api/v1/task-statuses': { get: { tags: ['References'], operationId: 'listTaskStatuses', summary: 'List statuses and final/default flags', security: bearer, parameters: [requestId], responses: { '200': response(array(ref('Status'))), ...listErrors('400','401','403','429','500','503') } } },
    '/api/v1/task-assignees': { get: { tags: ['References'], operationId: 'searchTaskAssignees', summary: 'Search active eligible assignees', security: bearer, parameters: [requestId,query('query',string({ maxLength: 500 })),query('limit',{ type: 'integer', minimum: 1, maximum: 100, default: 50 })], responses: { '200': response(array(ref('UserRef'))), ...listErrors('400','401','403','429','500','503') } } },
    '/api/v1/integration-keys': {
      get: { tags: ['Integration keys'], operationId: 'listOwnIntegrationKeys', summary: 'List the verified user’s key metadata', security: browser, parameters: [requestId], responses: { '200': response(array(ref('Credential'))), ...listErrors('400','401','403','500') } },
      post: { tags: ['Integration keys'], operationId: 'createOwnIntegrationKey', summary: 'Create a personal key; show secret once', security: browser, parameters: [requestId], requestBody: jsonBody(ref('CredentialCreate')), responses: { '201': response(ref('CredentialIssued'),'Created'), ...listErrors('400','401','403','409','413','415','500') } },
    },
    '/api/v1/integration-keys/{id}': { delete: { tags: ['Integration keys'], operationId: 'revokeOwnIntegrationKey', summary: 'Revoke a personal key', description: 'Revocation takes effect on the next resource/exchange request, including previously issued capability sessions.', security: browser, parameters: [id,requestId], responses: { '200': response(ref('Credential')), ...listErrors('400','401','403','404','500') } } },
    '/api/v1/mcp/exchange': { post: { tags: ['MCP exchange'], operationId: 'exchangeMcpKey', summary: 'Backend-only MCP key exchange', description: 'The gateway sends its own OMNIA_MCP_EXCHANGE_SECRET bearer and the user-owned MCP key in the JSON body. Raw MCP keys cannot directly call task resources; API keys/capabilities cannot exchange. Exchange is enabled if either integration switch is true.', security: [{ mcpExchangeSecretBearer: [] }], parameters: [requestId], requestBody: jsonBody(ref('ExchangeRequest')), responses: { '201': response(ref('CapabilityIssued'),'Capability issued'), ...listErrors('400','401','403','409','413','415','429','500','503') } } },
  },
}

writeFileSync('docs/api/tasks-v1.openapi.json', `${JSON.stringify(spec,null,2)}\n`)
