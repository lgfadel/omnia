'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, KeyRound, RotateCw, ShieldCheck, Trash2 } from 'lucide-react'
import { Layout } from '@/components/layout/Layout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { BreadcrumbOmnia } from '@/components/ui/breadcrumb-omnia'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useToast } from '@/hooks/use-toast'
import { integrationKeysRepo, type NewIntegrationKey } from '@/repositories/integrationKeysRepo.api'
import type { IntegrationCredentialDTO, IntegrationCredentialCreateDTO } from '@/lib/tasksApiContracts'

const scopeOptions = [
  {value:'tasks:read',label:'Ler tarefas'},
  {value:'tasks:create',label:'Criar tarefas'},
  {value:'tasks:update',label:'Atualizar tarefas'},
  {value:'tasks:comment',label:'Comentar em tarefas'},
] as const
type KeyFilter = 'active' | 'revoked'
// "Ativas" is everything not revoked: an expired key stays here so it can still be revoked or replaced.
const keyFilterOptions: {value:KeyFilter;label:string}[] = [{value:'active',label:'Ativas'},{value:'revoked',label:'Revogadas'}]
type KeyLifetime = 7 | 30 | 90 | 'never'
const lifetimeOptions: {value:KeyLifetime;label:string}[] = [{value:7,label:'7 dias'},{value:30,label:'30 dias'},{value:90,label:'90 dias'},{value:'never',label:'Sem prazo'}]
const DAY_MS = 86_400_000
const expiryFor = (lifetime:KeyLifetime) => lifetime === 'never' ? null : new Date(Date.now() + lifetime * DAY_MS).toISOString()
// Replacement keeps the lifetime of the key it replaces; an unusual span falls back to the default.
const lifetimeOf = (key:IntegrationCredentialDTO):KeyLifetime => {
  if (!key.expiresAt) return 'never'
  const days = Math.round((Date.parse(key.expiresAt) - Date.parse(key.createdAt)) / DAY_MS)
  return days === 7 || days === 30 || days === 90 ? days : 90
}
const formatDate = (value:string) => new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))
const errorMessage = (error:unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.'

function IntegrationKeysContent() {
  const { toast } = useToast()
  const [keys,setKeys] = useState<IntegrationCredentialDTO[]>([])
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState<string|null>(null)
  const [name,setName] = useState('')
  const [audience,setAudience] = useState<'api'|'mcp'>('api')
  const [scopes,setScopes] = useState<IntegrationCredentialCreateDTO['scopes']>(['tasks:read'])
  const [issued,setIssued] = useState<NewIntegrationKey|null>(null)
  const [replacementId,setReplacementId] = useState<string|null>(null)
  const [lifetime,setLifetime] = useState<KeyLifetime>(90)
  const [filter,setFilter] = useState<KeyFilter>('active')
  const counts = useMemo(() => ({active:keys.filter(key => !key.revokedAt).length,revoked:keys.filter(key => key.revokedAt).length}),[keys])
  const visibleKeys = useMemo(() => keys.filter(key => filter === 'revoked' ? !!key.revokedAt : !key.revokedAt),[keys,filter])

  const load = useCallback(async () => {
    try { setKeys(await integrationKeysRepo.list()); setError(null) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setLoading(false) }
  },[])
  useEffect(() => { void load(); return () => setIssued(null) },[load])

  const toggleScope = (scope:IntegrationCredentialCreateDTO['scopes'][number],checked:boolean) => {
    setScopes(current => checked ? [...new Set([...current,scope])] : current.filter(value => value !== scope))
  }
  const create = async (event:React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || scopes.length === 0 || issued) return
    setBusy(true);setError(null)
    try {
      const result = await integrationKeysRepo.create({name:name.trim(),audience,scopes,expiresAt:expiryFor(lifetime)})
      setIssued(result)
      setName('')
      let replacementError: string | null = null
      if (replacementId) {
        try { await integrationKeysRepo.revoke(replacementId) }
        catch { replacementError = 'Nova chave criada, mas não foi possível revogar a anterior. Revogue-a manualmente.' }
        setReplacementId(null)
      }
      await load()
      if (replacementError) setError(replacementError)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  const revoke = async (key:IntegrationCredentialDTO) => {
    if (!window.confirm(`Revogar a chave “${key.name}”? Ela deixará de funcionar imediatamente.`)) return
    setBusy(true);setError(null)
    try { await integrationKeysRepo.revoke(key.id); if (issued?.id === key.id) setIssued(null); await load(); toast({title:'Chave revogada'}) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  const replace = (key:IntegrationCredentialDTO) => {
    setReplacementId(key.id);setName(`${key.name} — nova`);setAudience(key.audience);setScopes(key.scopes);setLifetime(lifetimeOf(key))
    document.getElementById('integration-key-name')?.focus()
  }
  const copy = async () => {
    if (!issued) return
    try { await navigator.clipboard.writeText(issued.token); toast({title:'Chave copiada'}) }
    catch { toast({title:'Não foi possível copiar a chave',variant:'destructive'}) }
  }

  return <Layout><div className="mx-auto max-w-4xl space-y-7">
    <BreadcrumbOmnia items={[{label:'Início',href:'/'},{label:'Integrações',isActive:true}]} />
    <div className="flex items-start gap-3"><KeyRound aria-hidden="true" className="mt-1 h-6 w-6 text-primary" /><div>
      <h1 className="text-2xl font-semibold">Minhas integrações</h1>
      <p className="mt-1 text-sm text-muted-foreground">Crie chaves pessoais para automatizar tarefas com as suas permissões. A identidade usada é a sua; cada ação obedece ao seu acesso atual.</p>
    </div></div>
    <section aria-labelledby="new-key-title" className="rounded-lg border bg-card p-5 sm:p-6">
      <h2 id="new-key-title" className="font-semibold">Criar chave</h2>
      <p className="mt-1 text-sm text-muted-foreground">Escolha por quanto tempo a chave vale. O valor completo aparece uma única vez após a criação.</p>
      <form onSubmit={create} className="mt-5 space-y-5">
        <div className="max-w-md space-y-2"><Label htmlFor="integration-key-name">Nome da chave</Label><Input id="integration-key-name" value={name} onChange={event=>setName(event.target.value)} maxLength={100} placeholder="Ex.: automação de tarefas" required /></div>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Tipo de acesso</legend><div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="audience" checked={audience==='api'} onChange={()=>setAudience('api')} /> API para automações</label>
          <label className="flex items-center gap-2"><input type="radio" name="audience" checked={audience==='mcp'} onChange={()=>setAudience('mcp')} /> MCP para Grok Bot</label>
        </div></fieldset>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Permissões da chave</legend><div className="flex flex-wrap gap-x-6 gap-y-2">
          {scopeOptions.map(option=><label key={option.value} className="flex items-center gap-2 text-sm"><Checkbox checked={scopes.includes(option.value)} onCheckedChange={checked=>toggleScope(option.value,checked===true)} />{option.label}</label>)}
        </div></fieldset>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Validade da chave</legend><div className="flex flex-wrap gap-5 text-sm">
          {lifetimeOptions.map(option=><label key={option.value} className="flex items-center gap-2"><input type="radio" name="lifetime" checked={lifetime===option.value} onChange={()=>setLifetime(option.value)} /> {option.label}</label>)}
        </div>{lifetime==='never' && <p className="text-xs text-muted-foreground">Uma chave sem prazo só deixa de funcionar quando for revogada. Guarde-a com cuidado e revogue-a quando não precisar mais dela.</p>}</fieldset>
        {replacementId && <p className="text-sm text-muted-foreground">Após criar a nova chave, a chave anterior será revogada.</p>}
        <Button type="submit" disabled={busy || !!issued || scopes.length===0}>{busy?'Criando...':replacementId?'Criar substituta':'Criar chave'}</Button>
      </form>
    </section>
    {issued && <section aria-live="polite" className="rounded-lg border border-primary/40 bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="h-5 w-5 text-primary" /><h2 className="font-semibold">Copie sua chave agora</h2></div>
      <p className="mt-2 text-sm text-muted-foreground">Guarde-a no gerenciador de segredos da sua integração. Depois de concluir, não será possível vê-la novamente.</p>
      <code className="mt-4 block overflow-x-auto rounded-md bg-muted p-3 text-sm" aria-label="Chave recém-criada">{issued.token}</code>
      <div className="mt-4 flex gap-2"><Button type="button" onClick={copy}><Copy className="mr-2 h-4 w-4" />Copiar</Button><Button type="button" variant="outline" onClick={()=>setIssued(null)}>Concluído</Button></div>
    </section>}
    <section aria-labelledby="keys-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="keys-title" className="font-semibold">Chaves criadas</h2>
        {keys.length>0 && <ToggleGroup type="single" value={filter} onValueChange={value => { if (value) setFilter(value as KeyFilter) }} aria-label="Filtrar chaves por situação" className="rounded-lg bg-muted p-0.5">
          {keyFilterOptions.map(option => <ToggleGroupItem key={option.value} value={option.value} className="h-8 gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm">
            {option.label}<span className="text-xs tabular-nums opacity-70">{counts[option.value]}</span>
          </ToggleGroupItem>)}
        </ToggleGroup>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading ? <p className="text-sm text-muted-foreground">Carregando chaves...</p> : keys.length===0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Nenhuma chave criada. Escolha o tipo de acesso e as permissões acima para começar.</p> :
        visibleKeys.length===0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">{filter==='active'?'Nenhuma chave ativa. Crie uma nova acima ou veja as revogadas no filtro.':'Nenhuma chave revogada.'}</p> :
        <ul className="divide-y rounded-lg border">{visibleKeys.map(key=><li key={key.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{key.name}</span><Badge variant="outline">{key.audience.toUpperCase()}</Badge><Badge variant={key.revokedAt?'destructive':'secondary'}>{key.revokedAt?'Revogada':key.expiresAt && new Date(key.expiresAt)<new Date()?'Expirada':'Ativa'}</Badge></div>
            <p className="text-xs text-muted-foreground">{key.scopes.join(' · ')} · {key.expiresAt?`Expira em ${formatDate(key.expiresAt)}`:'Sem prazo de expiração'}{key.lastUsedAt?` · Último uso ${formatDate(key.lastUsedAt)}`:''}</p></div>
          {!key.revokedAt && <div className="flex shrink-0 gap-2"><Button type="button" size="sm" variant="outline" disabled={busy || !!issued} onClick={()=>replace(key)}><RotateCw className="mr-1 h-4 w-4" />Substituir</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={()=>revoke(key)}><Trash2 className="mr-1 h-4 w-4" />Revogar</Button></div>}
        </li>)}</ul>}
      <p className="text-xs text-muted-foreground">Para conectar um cliente, use a configuração fornecida pelo administrador da sua organização.</p>
    </section>
  </div></Layout>
}

export default function IntegracoesPage() {
  return <ProtectedRoute><IntegrationKeysContent /></ProtectedRoute>
}
