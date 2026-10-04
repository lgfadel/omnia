import { test, expect } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

type Key = { id:string; name:string; audience:'api'|'mcp'; scopes:string[]; createdAt:string; expiresAt:string; revokedAt:string|null; lastUsedAt:string|null }
const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..')
const fixture = path.join(here, 'fixtures/integration-keys-smoke')
const stubs = path.join(fixture, 'stubs.tsx')
const state = { keys: [] as Key[], serial: 0, failNextRevoke: false, requests: [] as {method:string;path:string;authorization:string|undefined}[] }
let vite: ViteDevServer
let baseURL: string

test.skip(({browserName})=>browserName!=='chromium','Clipboard permission API for this isolated smoke is Chromium-only')

function json(response:ServerResponse, status:number, body:unknown) {
  response.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'})
  response.end(JSON.stringify(body))
}
async function handleApi(request:IncomingMessage,response:ServerResponse) {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  state.requests.push({method:request.method ?? '',path:pathname,authorization:request.headers.authorization})
  const requestId = randomUUID()
  if (request.headers.authorization !== 'Bearer dummy.browser.token') return json(response,401,{error:{code:'INVALID_AUTH',message:'Test bearer required'},requestId})
  if (pathname === '/api/v1/integration-keys' && request.method === 'GET') return json(response,200,{data:state.keys,requestId})
  if (pathname === '/api/v1/integration-keys' && request.method === 'POST') {
    let input = ''
    for await (const chunk of request) input += chunk.toString()
    const body = JSON.parse(input) as {name:string;audience:'api'|'mcp';scopes:string[]}
    const serial = ++state.serial
    const key:Key = {id:`00000000-0000-4000-8000-${String(serial).padStart(12,'0')}`,name:body.name,audience:body.audience,scopes:body.scopes,createdAt:'2026-10-04T12:00:00Z',expiresAt:'2027-01-02T12:00:00Z',revokedAt:null,lastUsedAt:null}
    state.keys.push(key)
    return json(response,201,{data:{...key,token:`omnia_${body.audience}_dummy_only_${serial}`},requestId})
  }
  const match = pathname.match(/^\/api\/v1\/integration-keys\/([0-9a-f-]+)$/)
  if (match && request.method === 'DELETE') {
    if (state.failNextRevoke) { state.failNextRevoke = false; return json(response,403,{error:{code:'FORBIDDEN',message:'Controlled revoke failure'},requestId}) }
    const key = state.keys.find(value=>value.id===match[1])
    if (!key) return json(response,404,{error:{code:'NOT_FOUND',message:'Controlled missing key'},requestId})
    key.revokedAt = '2026-10-04T13:00:00Z'
    return json(response,200,{data:key,requestId})
  }
  return json(response,404,{error:{code:'NOT_FOUND',message:'Unexpected test route'},requestId})
}

test.beforeAll(async () => {
  vite = await createServer({
    configFile:false,
    root:fixture,
    appType:'spa',
    esbuild:{jsx:'automatic'},
    resolve:{alias:[
      ...['integrations/supabase/client','components/layout/Layout','components/auth/ProtectedRoute','components/ui/breadcrumb-omnia','hooks/use-toast'].map(value=>({find:`@/${value}`,replacement:stubs})),
      {find:/^@\//,replacement:`${path.join(repo,'apps/web-next/src')}/`},
    ]},
    plugins:[{name:'isolated-keys-api',configureServer(server){server.middlewares.use((request,response,next)=>{
      if (request.url?.startsWith('/api/v1/integration-keys')) void handleApi(request,response)
      else next()
    })}}],
    server:{host:'127.0.0.1',port:0,strictPort:true},
  })
  await vite.listen()
  const address = vite.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not bind a test port')
  baseURL = `http://127.0.0.1:${address.port}`
})
test.afterAll(async () => { await vite?.close() })

test('personal key lifecycle through the actual page and HTTP adapter', async ({page,context}) => {
  state.keys.length = 0; state.requests.length = 0; state.serial = 0; state.failNextRevoke = false
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:baseURL})
  page.on('dialog',dialog=>void dialog.accept())
  await page.goto(baseURL)
  await expect(page.getByText(/Nenhuma chave criada/)).toBeVisible()

  await page.getByLabel('Nome da chave').fill('Bot pessoal')
  await page.getByLabel('MCP para Grok Bot').check()
  await page.getByRole('button',{name:'Criar chave',exact:true}).click()
  await expect(page.getByLabel('Chave recém-criada')).toHaveText('omnia_mcp_dummy_only_1')
  await page.getByRole('button',{name:'Copiar'}).click()
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('omnia_mcp_dummy_only_1')
  await page.getByRole('button',{name:'Concluído'}).click()
  await expect(page.getByText('omnia_mcp_dummy_only_1')).toHaveCount(0)
  await expect(page.getByText('Bot pessoal')).toBeVisible()

  await page.getByRole('button',{name:'Revogar'}).click()
  await expect(page.getByText('Revogada')).toBeVisible()
  expect(state.keys[0].revokedAt).not.toBeNull()

  await page.getByLabel('Nome da chave').fill('Automação direta')
  await page.getByLabel('API para automações').check()
  await page.getByRole('button',{name:'Criar chave',exact:true}).click()
  await expect(page.getByLabel('Chave recém-criada')).toHaveText('omnia_api_dummy_only_2')
  await page.getByRole('button',{name:'Concluído'}).click()
  await page.getByRole('button',{name:'Substituir'}).click()
  state.failNextRevoke = true
  await page.getByRole('button',{name:'Criar substituta'}).click()
  await expect(page.getByRole('alert')).toContainText('Revogue-a manualmente')
  await expect(page.getByLabel('Chave recém-criada')).toHaveText('omnia_api_dummy_only_3')
  expect(state.keys[1].revokedAt).toBeNull()
  expect(state.keys[2].revokedAt).toBeNull()
  await page.getByRole('button',{name:'Concluído'}).click()
  await expect(page.getByText('omnia_api_dummy_only_3')).toHaveCount(0)
  // Vite can re-render the page after dependency prebundling, causing an extra
  // initial GET. The write sequence is the lifecycle invariant here.
  expect(state.requests.filter(request=>request.method!=='GET').map(request=>request.method)).toEqual(['POST','DELETE','POST','POST','DELETE'])
  expect(state.requests.filter(request=>request.method==='GET').length).toBeGreaterThanOrEqual(4)
  expect(state.requests.every(request=>request.authorization==='Bearer dummy.browser.token')).toBe(true)
})
