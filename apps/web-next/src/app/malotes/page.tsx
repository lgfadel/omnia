'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Send, Upload } from 'lucide-react'
import { Layout } from '@/components/layout/Layout'
import { BreadcrumbOmnia } from '@/components/ui/breadcrumb-omnia'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CondominiumSelect } from '@/components/condominiums/CondominiumSelect'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MaloteHistory, type MaloteHistoryBatch } from '@/components/malotes/MaloteHistory'
import { useCondominiumStore } from '@/stores/condominiums.store'
import { supabase } from '@/integrations/supabase/client'
import { MALOTE_MAX_FILES_PER_BATCH, maloteSendProgress, validateMaloteFile, type MaloteSendEvent, type MaloteSendResult } from '@/lib/malotes'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/components/auth/AuthProvider'

type Settings = { recipient_email: string; default_subject_template: string; default_body_template: string }


async function api(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}`, ...init?.headers } })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error ?? 'Não foi possível concluir a operação.')
  return body
}

/** Lê os eventos NDJSON do envio conforme o servidor despacha cada e-mail. */
async function apiStream(path: string, payload: string, onEvent: (event: MaloteSendEvent) => void) {
  const { data } = await supabase.auth.getSession()
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: payload,
  })
  if (!response.ok || !response.body) {
    const failure = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(failure.error ?? 'Não foi possível concluir a operação.')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const handle = (line: string) => {
    if (!line.trim()) return
    const event = JSON.parse(line) as MaloteSendEvent
    if (event.type === 'error') throw new Error(event.message)
    onEvent(event)
  }
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) handle(line)
    }
    handle(buffer)
  } finally {
    reader.releaseLock()
  }
}

export default function MalotesPage() {
  const { condominiums, loadCondominiums } = useCondominiumStore()
  const { userProfile } = useAuth()
  const { toast } = useToast()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [condominiumId, setCondominiumId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [history, setHistory] = useState<MaloteHistoryBatch[]>([])
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState<{ uploaded: number; sent: number; total: number } | null>(null)

  const activeCondominiums = useMemo(() => condominiums.filter((item) => item.active !== false), [condominiums])

  const loadData = useCallback(async () => {
    try {
      const [savedSettings, savedHistory] = await Promise.all([api('/api/malotes/settings'), api('/api/malotes/history')])
      setSettings(savedSettings)
      setSubject(savedSettings.default_subject_template)
      setBody(savedSettings.default_body_template)
      setHistory(savedHistory)
    } catch (error) { toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro ao carregar malotes.', variant: 'destructive' }) }
  }, [toast])

  useEffect(() => { loadCondominiums(); loadData() }, [loadCondominiums, loadData])

  const selectFiles = (selected: FileList | null) => {
    if (!selected) return
    const candidate = Array.from(selected)
    if (candidate.length > MALOTE_MAX_FILES_PER_BATCH) return toast({ title: 'Limite excedido', description: `Envie no máximo ${MALOTE_MAX_FILES_PER_BATCH} arquivos por malote.`, variant: 'destructive' })
    for (const file of candidate) {
      const validation = validateMaloteFile(file)
      if (!validation.valid) return toast({ title: 'Arquivo inválido', description: validation.error, variant: 'destructive' })
    }
    setFiles(candidate)
  }

  const send = async () => {
    if (!condominiumId || files.length === 0) return toast({ title: 'Dados incompletos', description: 'Selecione o condomínio e ao menos um arquivo.', variant: 'destructive' })
    setSending(true)
    setProgress({ uploaded: 0, sent: 0, total: files.length })
    try {
      const prepared = await api('/api/malotes/prepare', { method: 'POST', body: JSON.stringify({ condominiumId, subjectTemplate: subject, bodyTemplate: body, files: files.map(({ name, size, type }) => ({ name, size, type })) }) })
      for (let index = 0; index < files.length; index += 1) {
        const upload = prepared.uploads[index]
        const { error } = await supabase.storage.from('malote-attachments').uploadToSignedUrl(upload.path, upload.token, files[index])
        if (error) throw new Error(`Falha no upload de ${files[index].name}: ${error.message}`)
        await api(`/api/malotes/items/${upload.itemId}/uploaded`, { method: 'POST', body: '{}' })
        setProgress((current) => (current ? { ...current, uploaded: index + 1 } : current))
      }
      let results: MaloteSendResult[] = []
      await apiStream(`/api/malotes/${prepared.batchId}/send`, '{}', (event) => {
        if (event.type === 'item') setProgress((current) => (current ? { ...current, sent: current.sent + 1 } : current))
        if (event.type === 'done') results = event.results
      })
      const failed = results.filter((item) => item.status === 'failed').length
      toast({ title: failed ? 'Malote enviado parcialmente' : 'Malote enviado', description: failed ? `${failed} arquivo(s) falharam; use o histórico para reenviar.` : `${files.length} e-mail(s) enviados com sucesso.` })
      setFiles([])
      await loadData()
    } catch (error) { toast({ title: 'Falha no envio', description: error instanceof Error ? error.message : 'Erro inesperado.', variant: 'destructive' }) }
    finally { setSending(false); setProgress(null) }
  }

  const retry = async (batchId: string, itemId: string) => {
    try { await apiStream(`/api/malotes/${batchId}/send`, JSON.stringify({ itemIds: [itemId] }), () => {}); toast({ title: 'Reenvio concluído' }); await loadData() }
    catch (error) { toast({ title: 'Falha no reenvio', description: error instanceof Error ? error.message : 'Erro inesperado.', variant: 'destructive' }) }
  }
  const resolveDelivery = async (itemId: string) => {
    try { await api(`/api/malotes/items/${itemId}/resolve`, { method: 'POST', body: '{}' }); toast({ title: 'Entrega reconciliada', description: 'O histórico foi atualizado conforme a última tentativa registrada.' }); await loadData() }
    catch (error) { toast({ title: 'Falha ao resolver entrega', description: error instanceof Error ? error.message : 'Erro inesperado.', variant: 'destructive' }) }
  }

  const sendPercent = progress ? maloteSendProgress(progress.uploaded, progress.sent, progress.total) : 0
  const progressLabel = progress
    ? progress.uploaded < progress.total
      ? `Anexando arquivo ${progress.uploaded + 1} de ${progress.total}`
      : `Enviando e-mail ${Math.min(progress.sent + 1, progress.total)} de ${progress.total}`
    : null

  const formPanel = <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
      <section className="space-y-5 rounded-xl border bg-card p-6 shadow-sm">
        <div><h2 className="font-semibold">Preparar envio</h2><p className="text-sm text-muted-foreground">Destinatário: {settings?.recipient_email || 'não configurado'}</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Condomínio</Label><CondominiumSelect condominiums={activeCondominiums} value={condominiumId} onValueChange={setCondominiumId} placeholder="Selecione o condomínio" /></div><div className="space-y-2"><Label htmlFor="malote-files">Arquivos</Label><label htmlFor="malote-files" className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 text-sm font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/15 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"><Upload className="h-4 w-4" /><span className="truncate">{files.length ? `${files.length} arquivo(s) selecionado(s)` : 'Escolher arquivos'}</span><input id="malote-files" type="file" multiple className="sr-only" onChange={(event) => { selectFiles(event.target.files); event.target.value = '' }} /></label></div></div>
        {files.length > 0 && <div className="rounded-lg bg-muted/50 p-3 text-sm"><div className="mb-2 flex items-center gap-2 font-medium"><Upload className="h-4 w-4" />{files.length} arquivo(s) pronto(s)</div>{files.map((file) => <p key={`${file.name}-${file.size}`} className="truncate text-muted-foreground">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>)}</div>}
        <div className="space-y-2"><Label>Assunto</Label><Input value={subject} onChange={(event) => setSubject(event.target.value)} /></div>
        <div className="space-y-2"><Label>Mensagem</Label><Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={8} /><p className="text-xs text-muted-foreground">Variáveis: {'{{condominio}}'}, {'{{data_envio}}'}, {'{{arquivo}}'}.</p></div>
        <div className="flex flex-wrap items-center gap-4">
          <Button className="w-full sm:w-auto" onClick={send} disabled={sending || !settings?.recipient_email}>{sending ? `Enviando… ${sendPercent}%` : <><Send className="mr-2 h-4 w-4" />Enviar malote</>}</Button>
          {progress && <div className="min-w-[200px] flex-1 space-y-1.5" role="status" aria-live="polite">
            <Progress value={sendPercent} className="h-1.5" />
            <p className="text-xs text-muted-foreground">{progressLabel}</p>
          </div>}
        </div>
      </section>
      <aside className="space-y-3 rounded-xl border border-dashed p-5"><FileText className="h-5 w-5 text-primary" /><h2 className="font-semibold">Como funciona</h2><ol className="space-y-2 text-sm text-muted-foreground"><li>1. Escolha o condomínio.</li><li>2. Revise a mensagem padrão.</li><li>3. Anexe até 20 arquivos.</li><li>4. Acompanhe cada envio no histórico.</li></ol></aside>
  </div>

  const historyPanel = <MaloteHistory
    batches={history}
    condominiums={condominiums}
    canResolveDelivery={Boolean(userProfile?.roles.includes('ADMIN'))}
    onRetry={retry}
    onResolveDelivery={resolveDelivery}
  />

  return <Layout><div className="mx-auto max-w-6xl space-y-6">
    <BreadcrumbOmnia items={[{ label: 'Malotes', isActive: true }]} />
    <section className="border-b border-primary/15 pb-6"><h1 className="text-3xl font-semibold tracking-tight">Malotes digitais</h1></section>
    <Tabs defaultValue="novo" className="space-y-6">
      <TabsList>
        <TabsTrigger value="novo">Novo envio</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="novo">{formPanel}</TabsContent>
      <TabsContent value="historico">{historyPanel}</TabsContent>
    </Tabs>
  </div></Layout>
}
