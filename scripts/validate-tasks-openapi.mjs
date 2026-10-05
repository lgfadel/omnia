import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const spec = JSON.parse(readFileSync('docs/api/tasks-v1.openapi.json','utf8'))
const contracts = ts.createSourceFile('tasksApiContracts.ts',readFileSync('apps/web-next/src/lib/tasksApiContracts.ts','utf8'),ts.ScriptTarget.Latest,true)
let checks = 0
function equal(actual,expected,label) { assert.deepEqual(actual,expected,label); checks++ }
function yes(value,label) { assert.ok(value,label); checks++ }
function variable(name) {
  for (const statement of contracts.statements) {
    if (!ts.isVariableStatement(statement)) continue
    const declaration = statement.declarationList.declarations.find(item=>item.name.getText(contracts)===name)
    if (declaration) return declaration.initializer
  }
  throw new Error(`Missing source contract ${name}`)
}
function object(expression) {
  if (ts.isIdentifier(expression)) return object(variable(expression.text))
  if (ts.isObjectLiteralExpression(expression)) return expression
  if (ts.isCallExpression(expression)) {
    if (ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text==='object') return object(expression.arguments[0])
    return object(expression.expression)
  }
  if (ts.isPropertyAccessExpression(expression)) return object(expression.expression)
  throw new Error(`Expected object contract: ${expression.getText(contracts)}`)
}
function fields(name) {
  const members = new Map()
  for (const property of object(variable(name)).properties) {
    if (ts.isSpreadAssignment(property)) {
      for (const [key,value] of fields(property.expression.getText(contracts))) members.set(key,value)
    } else if (ts.isPropertyAssignment(property)) members.set(property.name.getText(contracts).replaceAll(/['"]/g,''),property.initializer.getText(contracts))
    else throw new Error(`Unexpected source property in ${name}`)
  }
  return members
}
function names(value) {return [...value].sort()}
function schema(name) {return spec.components.schemas[name]}
function schemaKeys(name) {return names(Object.keys(schema(name).properties))}
function sourceKeys(name) {return names(fields(name).keys())}
function nullable(property) {return property?.anyOf?.some(item=>item.type==='null')===true}
function header(operation,name) {return operation.parameters?.find(parameter=>parameter.in==='header'&&parameter.name===name)}
function result(operation,status) {return operation.responses[String(status)]}
function dataRef(operation,status) {return result(operation,status).content['application/json'].schema.properties.data}
function methodMap(dir) {
  const source = readFileSync(dir,'utf8')
  return names([...source.matchAll(/export async function (GET|POST|PATCH|DELETE)\(/g)].map(match=>match[1].toLowerCase()))
}

equal(spec.openapi,'3.1.0','OpenAPI version')
const routes = {
  '/api/v1/tasks':['apps/web-next/src/app/api/v1/tasks/route.ts',{get:['TaskPage',200],post:['Task',201]}],
  '/api/v1/tasks/{id}':['apps/web-next/src/app/api/v1/tasks/[id]/route.ts',{get:['Task',200],patch:['Task',200]}],
  '/api/v1/tasks/{id}/comments':['apps/web-next/src/app/api/v1/tasks/[id]/comments/route.ts',{get:['CommentPage',200],post:['Comment',201]}],
  '/api/v1/tasks/{id}/comments/{commentId}':['apps/web-next/src/app/api/v1/tasks/[id]/comments/[commentId]/route.ts',{patch:['Comment',200],delete:['Comment',200]}],
  '/api/v1/task-statuses':['apps/web-next/src/app/api/v1/task-statuses/route.ts',{get:['Status',200]}],
  '/api/v1/task-assignees':['apps/web-next/src/app/api/v1/task-assignees/route.ts',{get:['UserRef',200]}],
  '/api/v1/integration-keys':['apps/web-next/src/app/api/v1/integration-keys/route.ts',{get:['Credential',200],post:['CredentialIssued',201]}],
  '/api/v1/integration-keys/{id}':['apps/web-next/src/app/api/v1/integration-keys/[id]/route.ts',{delete:['Credential',200]}],
  '/api/v1/mcp/exchange':['apps/web-next/src/app/api/v1/mcp/exchange/route.ts',{post:['CapabilityIssued',201]}],
}
equal(names(Object.keys(spec.paths)),names(Object.keys(routes)),'documented path set')
for (const [route,[file,operations]] of Object.entries(routes)) {
  equal(names(Object.keys(operations)),methodMap(file),`${route} methods in source`)
  equal(names(Object.keys(spec.paths[route])),methodMap(file),`${route} methods in OpenAPI`)
  for (const [method,[model,status]] of Object.entries(operations)) {
    const operation = spec.paths[route][method]
    const success = result(operation,status)
    yes(success,`${method} ${route} success`)
    equal(names(success.content['application/json'].schema.required),['data','requestId'],`${method} ${route} flat envelope`)
    equal(success.headers['X-Request-Id'].schema.format,'uuid',`${method} ${route} request header`)
    yes(success.headers['Cache-Control'],`${method} ${route} no-store success header`)
    const data = dataRef(operation,status)
    if (['Status','UserRef','Credential'].includes(model) && (route.includes('statuses')||route.includes('assignees')||route==='/api/v1/integration-keys'&&method==='get')) {
      equal(data.items.$ref,`#/components/schemas/${model}`,`${method} ${route} array item`)
    } else equal(data.$ref,`#/components/schemas/${model}`,`${method} ${route} response model`)
    for (const [code,response] of Object.entries(operation.responses)) {
      if (+code < 400) continue
      equal(response.content['application/json'].schema.$ref,'#/components/schemas/Failure',`${method} ${route} error envelope`)
      yes(response.headers['Cache-Control'] && response.headers['X-Request-Id'],`${method} ${route} error headers`)
    }
  }
}

for (const [model,source] of [
  ['Task','taskSchema'],['TaskCreate','taskCreateSchema'],['TaskPatch','taskPatchSchema'],
  ['UserRef','taskUserRefSchema'],['Status','taskStatusSchema'],['RecurrenceInput','taskRecurrenceInputSchema'],
  ['Recurrence','taskRecurrenceSchema'],['Credential','credentialSchema'],['CredentialCreate','credentialCreateSchema'],
  ['Comment','commentSchema'],['CommentCreate','commentCreateSchema'],['CommentUpdate','commentUpdateSchema'],
]) {
  equal(schemaKeys(model),sourceKeys(source),`${model} properties vs Zod source`)
  equal(schema(model).additionalProperties,false,`${model} strict fields`)
}
equal(schemaKeys('CredentialIssued'),names([...sourceKeys('credentialSchema'),'token']),'one-time key is flat')
equal(schemaKeys('CapabilityIssued'),names([...sourceKeys('mcpCapabilitySchema'),'token']),'one-time capability is flat')
yes(!schema('Credential').properties.token,'listed/revoked key has no secret')
yes(nullable(schema('Credential').properties.expiresAt),'a key without deadline reports expiresAt null')
yes(schema('Credential').required.includes('expiresAt'),'expiresAt is always present on a key')
yes(nullable(schema('CredentialCreate').properties.expiresAt),'explicit null selects a key without deadline')
yes(!schema('CredentialCreate').required.includes('expiresAt'),'omitting expiresAt keeps the default lifetime')
yes(!nullable(schema('CapabilityIssued').properties.expiresAt),'an MCP capability always expires')
equal(schema('Credential').properties.expiresAt.anyOf.find(item=>item.type==='string').format,'date-time','key expiry is an offset timestamp')
yes(!schema('Task').properties.version,'HTTP ETag is a header, not a task DTO field')
equal(schema('TaskCreate').required,['title'],'required create field')
equal(schema('TaskPatch').minProperties,1,'nonempty patch')
for (const name of ['description','dueDate','ticketOcta','assignedToId','oportunidadeId','recurrence']) {
  yes(fields('writable').get(name)?.includes('.nullable()'),`${name} nullable in source`)
  yes(nullable(schema('TaskCreate').properties[name]),`${name} nullable in create schema`)
  yes(nullable(schema('TaskPatch').properties[name]),`${name} nullable in patch schema`)
}
for (const name of ['createdById','assignedTo','createdBy','recurrence','recurrenceId','recurrenceOccurrence']) yes(nullable(schema('Task').properties[name]),`${name} nullable output`)
equal(schema('Task').properties.dueDate.anyOf[0].format,'date','dueDate calendar date')
equal(schema('Task').properties.updatedAt.format,'date-time','updatedAt offset timestamp')
yes(schema('Task').properties.ticketId.description.includes('distinct from ticketOcta'),'ticketId vs ticketOcta')
equal(schema('RecurrenceInput').required,['frequency','startDate'],'human recurrence required fields')
equal(names(schema('TaskPage').required),['items','nextCursor'],'page shape')
equal(names(schema('CommentPage').required),['items','nextCursor'],'comment page shape')
equal(schema('CommentPage').properties.items.items.$ref,'#/components/schemas/Comment','comment page items')
equal(schema('Scope').enum,[...variable('taskScopeSchema').getText(contracts).matchAll(/'([a-z]+:[a-z]+)'/g)].map(match=>match[1]),'scope enum vs Zod source')
equal(schema('CredentialCreate').properties.scopes.maxItems,schema('Scope').enum.length,'every scope can be requested together')
yes(nullable(schema('Comment').properties.author),'comment author nullable output')
equal(schema('Comment').properties.createdAt.format,'date-time','comment createdAt offset timestamp')
equal(schema('CommentCreate').required,['body'],'required comment field')
equal(schema('CommentUpdate').required,['body'],'required comment field on edit')
equal(schema('CommentCreate').properties.body.maxLength,10000,'comment body bound')
yes(schema('CommentCreate').properties.body.description.includes('trimmed'),'comment trimming documented')

const list = spec.paths['/api/v1/tasks'].get
equal(names(list.parameters.filter(parameter=>parameter.in==='query').map(parameter=>parameter.name)),sourceKeys('taskListQuerySchema'),'task filters vs Zod source')
const assignees = spec.paths['/api/v1/task-assignees'].get
equal(names(assignees.parameters.filter(parameter=>parameter.in==='query').map(parameter=>parameter.name)),sourceKeys('taskAssigneeQuerySchema'),'assignee filters vs Zod source')
for (const route of ['/api/v1/tasks','/api/v1/tasks/{id}']) {
  for (const [method,operation] of Object.entries(spec.paths[route])) {
    if (method==='post'||method==='patch') yes(header(operation,'Idempotency-Key')?.required,`${method} ${route} idempotency required`)
    if (method==='patch') {
      const standard=header(operation,'If-Match')
      const alias=header(operation,'X-Omnia-If-Match')
      yes(standard && alias,`${method} ${route} version transports documented`)
      equal(standard.required,false,`${method} ${route} standard version header may be replaced by alias`)
      equal(alias.required,false,`${method} ${route} alias may be replaced by standard header`)
      equal(alias.schema,standard.schema,`${method} ${route} identical strong version schemas`)
      yes(result(operation,412) && result(operation,428),`${method} ${route} stale/missing version errors`)
    }
    if (route.includes('{id}')||method==='post') yes(result(operation,method==='post'?201:200).headers.ETag,`${method} ${route} ETag header`)
  }
}
const commentList = spec.paths['/api/v1/tasks/{id}/comments'].get
equal(names(commentList.parameters.filter(parameter=>parameter.in==='query').map(parameter=>parameter.name)),sourceKeys('commentListQuerySchema'),'comment list query vs Zod source')
for (const route of ['/api/v1/tasks/{id}/comments','/api/v1/tasks/{id}/comments/{commentId}']) {
  yes(spec.paths[route].parameters?.some(parameter=>parameter.in==='path'&&parameter.name==='id')||Object.values(spec.paths[route]).every(operation=>operation.parameters?.some(parameter=>parameter.in==='path'&&parameter.name==='id')),`${route} documents the task id`)
  for (const [method,operation] of Object.entries(spec.paths[route])) {
    equal(operation.security,[{browserBearer:[]},{apiKeyBearer:[]},{mcpCapabilityBearer:[]}],`${method} ${route} security`)
    equal(!!header(operation,'Idempotency-Key')?.required,method==='post'||method==='patch',`${method} ${route} idempotency only on create and edit`)
    yes(!header(operation,'If-Match')&&!header(operation,'X-Omnia-If-Match'),`${method} ${route} has no version precondition`)
    yes(!result(operation,method==='post'?201:200).headers.ETag,`${method} ${route} comments carry no task ETag`)
    yes(result(operation,403)&&result(operation,404),`${method} ${route} authorization and visibility errors`)
  }
}
yes(spec.paths['/api/v1/tasks/{id}/comments/{commentId}'].delete.parameters.some(parameter=>parameter.in==='path'&&parameter.name==='commentId'),'delete documents the comment id')
for (const route of ['/api/v1/integration-keys','/api/v1/integration-keys/{id}']) for (const operation of Object.values(spec.paths[route])) equal(operation.security,[{browserBearer:[]}],`${route} browser only`)
equal(spec.paths['/api/v1/mcp/exchange'].post.security,[{mcpExchangeSecretBearer:[]}],'backend-only exchange')
for (const route of ['/api/v1/tasks','/api/v1/tasks/{id}','/api/v1/task-statuses','/api/v1/task-assignees']) for (const operation of Object.values(spec.paths[route])) equal(operation.security,[{browserBearer:[]},{apiKeyBearer:[]},{mcpCapabilityBearer:[]}],`${route} resource audiences`)
equal(spec.paths['/api/v1/tasks'].get.responses['429'].headers['Retry-After'].schema.const,'60','rate backoff')

console.log(`OpenAPI source-contract check: ${checks} assertions passed`)
