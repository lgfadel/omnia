'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, History, Send, Upload } from 'lucide-react'
import { Layout } from '@/components/layout/Layout'
import { BreadcrumbOmnia } from '@/components/ui/breadcrumb-omnia'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCondominiumStore } from '@/stores/condominiums.store'
import { supabase } from '@/integrations/supabase/client'
import { validateMalotePdf } from '@/lib/malotes'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/components/auth/AuthProvider'

type Settings = { recipient_email: string; default_subject_template: string; default_body_template: string }
type HistoryBatch = any

async function api(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}`, ...init?.headers } })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error ?? 'Não foi possível concluir a operação.')
  return body
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
  const [history, setHistory] = useState<HistoryBatch[]>([])
  const [sending, setSending] = useState(false)

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

  const selectFiles = async (selected: FileList | null) => {
    if (!selected) return
    const candidate = Array.from(selected)
    if (candidate.length > 20) return toast({ title: 'Limite excedido', description: 'Envie no máximo 20 PDFs.', variant: 'destructive' })
    for (const file of candidate) {
      const validation = await validateMalotePdf(file)
      if (!validation.valid) return toast({ title: 'Arquivo inválido', description: validation.error, variant: 'destructive' })
    }
    setFiles(candidate)
  }

  const send = async () => {
    if (!condominiumId || files.length === 0) return toast({ title: 'Dados incompletos', description: 'Selecione o condomínio e ao menos um PDF.', variant: 'destructive' })
    setSending(true)
    try {
      const prepared = await api('/api/malotes/prepare', { method: 'POST', body: JSON.stringify({ condominiumId, subjectTemplate: subject, bodyTemplate: body, files: files.map(({ name, size, type }) => ({ name, size, type })) }) })
      for (let index = 0; index < files.length; index += 1) {
        const upload = prepared.uploads[index]
        const { error } = await supabase.storage.from('malote-attachments').uploadToSignedUrl(upload.path, upload.token, files[index])
        if (error) throw new Error(`Falha no upload de ${files[index].name}: ${error.message}`)
        await api(`/api/malotes/items/${upload.itemId}/uploaded`, { method: 'POST', body: '{}' })
      }
      const result = await api(`/api/malotes/${prepared.batchId}/send`, { method: 'POST', body: '{}' })
      const failed = result.results.filter((item: any) => item.status === 'failed').length
      toast({ title: failed ? 'Malote enviado parcialmente' : 'Malote enviado', description: failed ? `${failed} arquivo(s) falharam; use o histórico para reenviar.` : `${files.length} e-mail(s) enviados com sucesso.` })
      setFiles([])
      await loadData()
    } catch (error) { toast({ title: 'Falha no envio', description: error instanceof Error ? error.message : 'Erro inesperado.', variant: 'destructive' }) }
    finally { setSending(false) }
  }

  const retry = async (batchId: string, itemId: string) => {
    try { await api(`/api/malotes/${batchId}/send`, { method: 'POST', body: JSON.stringify({ itemIds: [itemId] }) }); toast({ title: 'Reenvio concluído' }); await loadData() }
    catch (error) { toast({ title: 'Falha no reenvio', description: error instanceof Error ? error.message : 'Erro inesperado.', variant: 'destructive' }) }
  }
  const resolveDelivery = async (itemId: string) => {
    try { await api(`/api/malotes/items/${itemId}/resolve`, { method: 'POST', body: '{}' }); toast({ title: 'Entrega reconciliada', description: 'O histórico foi atualizado conforme a última tentativa registrada.' }); await loadData() }
    catch (error) { toast({ title: 'Falha ao resolver entrega', description: error instanceof Error ? error.message : 'Erro inesperado.', variant: 'destructive' }) }
  }

  return <Layout><div className="mx-auto max-w-6xl space-y-7">
    <BreadcrumbOmnia items={[{ label: 'Malotes', isActive: true }]} />
    <section className="border-b border-primary/15 pb-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Operação documental</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Malotes digitais</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Cada PDF é enviado em seu próprio e-mail ao destinatário corporativo configurado.</p></section>
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
      <section className="space-y-5 rounded-xl border bg-card p-6 shadow-sm">
        <div><h2 className="font-semibold">Preparar envio</h2><p className="text-sm text-muted-foreground">Destinatário: {settings?.recipient_email || 'não configurado'}</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Condomínio</Label><Select value={condominiumId} onValueChange={setCondominiumId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{condominiums.filter((item) => item.active !== false).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Arquivos PDF</Label><Input type="file" accept="application/pdf,.pdf" multiple onChange={(event) => selectFiles(event.target.files)} /></div></div>
        {files.length > 0 && <div className="rounded-lg bg-muted/50 p-3 text-sm"><div className="mb-2 flex items-center gap-2 font-medium"><Upload className="h-4 w-4" />{files.length} arquivo(s) pronto(s)</div>{files.map((file) => <p key={`${file.name}-${file.size}`} className="truncate text-muted-foreground">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>)}</div>}
        <div className="space-y-2"><Label>Assunto</Label><Input value={subject} onChange={(event) => setSubject(event.target.value)} /></div>
        <div className="space-y-2"><Label>Mensagem</Label><Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={8} /><p className="text-xs text-muted-foreground">Variáveis: {'{{condominio}}'}, {'{{data_envio}}'}, {'{{arquivo}}'}.</p></div>
        <Button className="w-full sm:w-auto" onClick={send} disabled={sending || !settings?.recipient_email}>{sending ? 'Enviando arquivos…' : <><Send className="mr-2 h-4 w-4" />Enviar malote</>}</Button>
      </section>
      <aside className="space-y-3 rounded-xl border border-dashed p-5"><FileText className="h-5 w-5 text-primary" /><h2 className="font-semibold">Como funciona</h2><ol className="space-y-2 text-sm text-muted-foreground"><li>1. Escolha o condomínio.</li><li>2. Revise a mensagem padrão.</li><li>3. Anexe até 20 PDFs.</li><li>4. Acompanhe cada envio no histórico.</li></ol></aside>
    </div>
    <section className="space-y-4"><div className="flex items-center gap-2"><History className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Histórico recente</h2></div><div className="overflow-hidden rounded-xl border">{history.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Nenhum malote enviado ainda.</p> : history.map((batch) => <div key={batch.id} className="border-b p-4 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{batch.condominium?.name ?? 'Condomínio'}</p><p className="text-xs text-muted-foreground">{new Date(batch.created_at).toLocaleString('pt-BR')} · por {batch.creator?.name ?? 'Usuário'}</p></div><span className="text-xs text-muted-foreground">{batch.recipient_email}</span></div>{batch.items?.map((item: any) => <div key={item.id} className="mt-3 flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"><span className="truncate">{item.file_name}</span><div className="flex items-center gap-2"><span className={item.status === 'sent' ? 'text-emerald-700' : item.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>{item.status}</span>{item.status === 'failed' && <Button size="sm" variant="outline" onClick={() => retry(batch.id, item.id)}>Reenviar</Button>}{item.status === 'sending' && userProfile?.roles.includes('ADMIN') && <Button size="sm" variant="outline" onClick={() => resolveDelivery(item.id)}>Resolver</Button>}</div></div>)}</div>)}</div></section>
  </div></Layout>
}
