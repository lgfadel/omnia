import { randomUUID } from 'node:crypto'
import { z } from 'zod/v4'

export type Config = {
  apiBaseUrl: string
  exchangeSecret: string
  allowedHosts: string[]
  allowedOrigins: string[]
  allowInsecureLocalhost?: boolean
  timeoutMs?: number
}

const uuid = z.uuid()
const success = z.object({data:z.unknown(),requestId:uuid}).strict()
const failure = z.object({error:z.object({code:z.string().max(100),message:z.string().max(300)}).strict(),requestId:uuid}).strict()
const exchangeData = z.object({
  id:uuid,audience:z.literal('api'),scopes:z.array(z.enum(['tasks:read','tasks:create','tasks:update'])),
  expiresAt:z.iso.datetime({offset:true}),token:z.string().regex(/^omnia_cap_[A-Za-z0-9_-]{43}$/),
}).strict()

export class ApiFailure extends Error {
  constructor(readonly code:string, readonly requestId:string, readonly status:number, message:string,readonly retryAfterSeconds?:number) {super(message)}
}

class ResponseTooLarge extends Error {}

function apiBase(config:Config):URL {
  const url = new URL(config.apiBaseUrl)
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(config.allowInsecureLocalhost && local && url.protocol==='http:')) throw new Error('OMNIA_API_BASE_URL must use HTTPS')
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' && url.pathname !== '') throw new Error('OMNIA_API_BASE_URL must be an origin')
  return url
}

export function validateConfig(config:Config):void {
  apiBase(config)
  if (!config.exchangeSecret || /\s/.test(config.exchangeSecret)) throw new Error('OMNIA_MCP_EXCHANGE_SECRET is required')
  if (!config.allowedHosts.length || config.allowedHosts.some(host=>!(/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(host)||host==='[::1]'))) throw new Error('OMNIA_MCP_ALLOWED_HOSTS must contain hostnames without ports')
  for (const origin of config.allowedOrigins) {
    const url = new URL(origin)
    if (url.origin !== origin || !['http:','https:'].includes(url.protocol)) throw new Error('Invalid allowed origin')
  }
}

export function loadConfig(env:NodeJS.ProcessEnv=process.env):Config {
  const config:Config = {
    apiBaseUrl:env.OMNIA_API_BASE_URL ?? '',exchangeSecret:env.OMNIA_MCP_EXCHANGE_SECRET ?? '',
    allowedHosts:(env.OMNIA_MCP_ALLOWED_HOSTS ?? '').split(',').map(value=>value.trim()).filter(Boolean),
    allowedOrigins:(env.OMNIA_MCP_ALLOWED_ORIGINS ?? '').split(',').map(value=>value.trim()).filter(Boolean),
    allowInsecureLocalhost:env.NODE_ENV==='development' && env.OMNIA_MCP_ALLOW_INSECURE_LOCALHOST==='true',
    timeoutMs:5000,
  }
  validateConfig(config)
  return config
}

async function boundedJson(response:Response):Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??'')) throw new Error('Unexpected upstream content type')
  const reader=response.body?.getReader()
  if (!reader) throw new Error('Empty upstream response')
  let size=0;const chunks:Uint8Array[]=[]
  try {
    while (true) {
      const {done,value}=await reader.read();if(done)break
      size+=value.byteLength
      if(size>524288) {await reader.cancel();throw new ResponseTooLarge()}
      chunks.push(value)
    }
  } finally {reader.releaseLock()}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

export function createApiClient(config:Config) {
  validateConfig(config)
  const base=apiBase(config)
  async function call(path:string,method:string,token:string,options?:{body?:unknown;version?:string;idempotencyKey?:string}) {
    const requestId=randomUUID()
    const url=new URL(path,base)
    const headers:Record<string,string>={Authorization:`Bearer ${token}`,'X-Request-Id':requestId,Accept:'application/json'}
    if(options?.body !== undefined) headers['Content-Type']='application/json'
    if(options?.version) headers['If-Match']=options.version
    if(options?.idempotencyKey) headers['Idempotency-Key']=options.idempotencyKey
    let response:Response
    try {
      response=await fetch(url,{method,headers,body:options?.body===undefined?undefined:JSON.stringify(options.body),redirect:'error',signal:AbortSignal.timeout(config.timeoutMs ?? 5000)})
    } catch {throw new ApiFailure('UPSTREAM_UNAVAILABLE',requestId,503,'Omnia API is unavailable')}
    let parsed:unknown
    try {parsed=await boundedJson(response)} catch(error) {
      if(error instanceof ResponseTooLarge) throw new ApiFailure('OUTPUT_TOO_LARGE',requestId,502,'Task result is too large; narrow the query or lower the limit')
      if(error instanceof Error && error.name==='TimeoutError') throw new ApiFailure('UPSTREAM_TIMEOUT',requestId,504,'Omnia API timed out')
      throw new ApiFailure('UPSTREAM_INVALID_RESPONSE',requestId,502,'Omnia API returned an invalid response')
    }
    if (!response.ok) {
      const error=failure.safeParse(parsed)
      if(error.success && error.data.requestId===response.headers.get('x-request-id')) {
        throw new ApiFailure(error.data.error.code,error.data.requestId,response.status,error.data.error.message,response.status===429&&response.headers.get('retry-after')==='60'?60:undefined)
      }
      throw new ApiFailure('UPSTREAM_ERROR',requestId,502,'Omnia API request failed')
    }
    const envelope=success.safeParse(parsed)
    if(!envelope.success || envelope.data.requestId!==response.headers.get('x-request-id')) throw new ApiFailure('UPSTREAM_INVALID_RESPONSE',requestId,502,'Omnia API returned an invalid response')
    return {data:envelope.data.data,requestId:envelope.data.requestId,etag:response.headers.get('etag')}
  }
  return {
    async exchange(mcpKey:string) {
      const result=await call('/api/v1/mcp/exchange','POST',config.exchangeSecret,{body:{mcpKey}})
      const capability=exchangeData.safeParse(result.data)
      if(!capability.success || Date.parse(capability.data.expiresAt)<=Date.now()) throw new ApiFailure('UPSTREAM_INVALID_RESPONSE',result.requestId,502,'Omnia API returned an invalid capability')
      return capability.data
    },
    resource:(path:string,method:string,capability:string,options?:{body?:unknown;version?:string;idempotencyKey?:string})=>call(path,method,capability,options),
  }
}
