import { createClient } from '@supabase/supabase-js'
import { createTasksApiHandler, type DispatchResult, type TasksApiConfig } from '@/server/tasksApiService'

function required(name:string):string {
  const value=process.env[name]
  if(!value)throw new Error('Task API configuration unavailable')
  return value
}
export function getTasksApiConfig():TasksApiConfig {
  return {
    readEnabled:process.env.OMNIA_INTEGRATIONS_READ_ENABLED==='true',
    writeEnabled:process.env.OMNIA_INTEGRATIONS_WRITE_ENABLED==='true',
    isVercel:process.env.VERCEL==='1',
    exchangeSecret:process.env.OMNIA_MCP_EXCHANGE_SECRET,
  }
}
const ATTACHMENTS_BUCKET='attachments'
/** Object paths in this project's attachments bucket only: other hosts, buckets or odd paths are never touched. */
export function attachmentPathsFromUrls(urls:string[],supabaseUrl:string):string[] {
  let origin:string
  try {origin=new URL(supabaseUrl).origin} catch {return []}
  const paths=new Set<string>()
  for(const value of urls){
    try{
      const url=new URL(value)
      const match=url.origin===origin ? url.pathname.match(new RegExp('^/storage/v1/object/public/'+ATTACHMENTS_BUCKET+'/(.+)$')) : null
      if(!match)continue
      const path=decodeURIComponent(match[1])
      if(path.startsWith('/')||path.split('/').some(part=>part===''||part==='.'||part==='..'))continue
      paths.add(path)
    }catch{continue}
  }
  return [...paths]
}
const authOptions={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
// Environment and clients are resolved on request, never during Next build/import.
export const tasksApiHandler=createTasksApiHandler({
  config:getTasksApiConfig,
  verifyBrowser:async token=>{
    const client=createClient(required('NEXT_PUBLIC_SUPABASE_URL'),required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),authOptions)
    const {data,error}=await client.auth.getUser(token)
    return error ? null : data.user?.id ?? null
  },
  removeStoredFiles:async urls=>{
    try{
      const supabaseUrl=required('NEXT_PUBLIC_SUPABASE_URL')
      const paths=attachmentPathsFromUrls(urls,supabaseUrl)
      if(!paths.length)return
      const client=createClient(supabaseUrl,required('SUPABASE_SERVICE_ROLE_KEY'),authOptions)
      const {error}=await client.storage.from(ATTACHMENTS_BUCKET).remove(paths)
      if(error)console.error('Task delete: stored files were not removed',paths.length)
    }catch{console.error('Task delete: stored file cleanup failed')}
  },
  dispatch:async args=>{
    const client=createClient(required('NEXT_PUBLIC_SUPABASE_URL'),required('SUPABASE_SERVICE_ROLE_KEY'),authOptions)
    const {data,error}=await client.rpc('tasks_api_dispatch',args)
    if(error)throw new Error('Task API persistence unavailable')
    if(!data || typeof data!=='object')throw new Error('Invalid task API response')
    return data as DispatchResult
  },
})
