'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, TriangleAlert } from 'lucide-react'
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute'
import { Layout } from '@/components/layout/Layout'
import { BreadcrumbOmnia } from '@/components/ui/breadcrumb-omnia'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import type { AtaMinutaReasoningEffort } from '@/data/types'

type Settings = { model: string; reasoning_effort: AtaMinutaReasoningEffort; system_prompt: string }

const reasoningEffortLabels: Record<AtaMinutaReasoningEffort, string> = {
  none: 'Nenhum',
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  xhigh: 'Extra alto',
  max: 'Máximo',
}

async function api(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}`, ...init?.headers } })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error ?? 'Não foi possível concluir a operação.')
  return body
}

export default function ConfigAtasPage() {
  const { toast } = useToast()
  const [model, setModel] = useState('')
  const [reasoningEffort, setReasoningEffort] = useState<AtaMinutaReasoningEffort>('high')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [verification, setVerification] = useState<{ ok: boolean; message: string } | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  useEffect(() => {
    api('/api/atas/minuta-settings')
      .then((settings: Settings) => {
        setModel(settings.model)
        setReasoningEffort(settings.reasoning_effort)
        setSystemPrompt(settings.system_prompt)
      })
      .catch((error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }))
  }, [toast])

  const save = async () => {
    setIsSaving(true)
    try {
      await api('/api/atas/minuta-settings', { method: 'PUT', body: JSON.stringify({ model, reasoningEffort, systemPrompt }) })
      toast({ title: 'Configuração salva' })
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro inesperado.', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const testModel = async () => {
    setIsVerifying(true)
    setVerification(null)
    try {
      setVerification(await api('/api/atas/minuta-settings/verify-model', { method: 'POST', body: JSON.stringify({ model }) }))
    } catch (error) {
      setVerification({ ok: false, message: error instanceof Error ? error.message : 'Erro inesperado.' })
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <RoleProtectedRoute allowedRoles={['ADMIN']}>
      <Layout>
        <div className="mx-auto max-w-3xl space-y-7">
          <BreadcrumbOmnia items={[{ label: 'Configurações', href: '/config' }, { label: 'Atas', isActive: true }]} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Administração</p>
            <h1 className="mt-2 text-3xl font-semibold">Geração de minuta de ATA</h1>
            <p className="mt-2 text-sm text-muted-foreground">Modelo, esforço de raciocínio e prompt usados para gerar a minuta a partir da transcrição revisada.</p>
          </div>

          <section className="space-y-5 rounded-xl border bg-card p-6">
            <div className="space-y-2">
              <Label>Id do modelo (OpenAI)</Label>
              <div className="flex gap-2">
                <Input value={model} onChange={(event) => { setModel(event.target.value); setVerification(null) }} placeholder="gpt-5.6-sol" />
                <Button type="button" variant="outline" disabled={isVerifying || !model.trim()} onClick={testModel}>
                  {isVerifying ? 'Testando…' : 'Testar modelo'}
                </Button>
              </div>
              {verification && (
                <p className={`flex items-center gap-1.5 text-sm ${verification.ok ? 'text-emerald-600' : 'text-destructive'}`}>
                  {verification.ok ? <CheckCircle2 className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
                  {verification.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Esforço de raciocínio</Label>
              <Select value={reasoningEffort} onValueChange={(value) => setReasoningEffort(value as AtaMinutaReasoningEffort)}>
                <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(reasoningEffortLabels) as AtaMinutaReasoningEffort[]).map((effort) => (
                    <SelectItem key={effort} value={effort}>{reasoningEffortLabels[effort]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prompt do secretário</Label>
              <Textarea rows={12} className="font-mono text-sm" value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} />
            </div>

            <Button onClick={save} disabled={isSaving}>{isSaving ? 'Salvando…' : 'Salvar configuração'}</Button>
          </section>
        </div>
      </Layout>
    </RoleProtectedRoute>
  )
}
