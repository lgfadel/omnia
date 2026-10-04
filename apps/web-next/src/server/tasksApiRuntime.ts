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
    exchangeSecret:process.env.OMNIA_MCP_EXCHANGE_SECRET,
  }
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
  dispatch:async args=>{
    const client=createClient(required('NEXT_PUBLIC_SUPABASE_URL'),required('SUPABASE_SERVICE_ROLE_KEY'),authOptions)
    const {data,error}=await client.rpc('tasks_api_dispatch',args)
    if(error)throw new Error('Task API persistence unavailable')
    if(!data || typeof data!=='object')throw new Error('Invalid task API response')
    return data as DispatchResult
  },
})
