"use client";

import { Layout } from "@/components/layout/Layout"
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CommentsList } from "@/components/atas/CommentsList"
import { CommentInput } from "@/components/atas/CommentInput"
import { AttachmentsList } from "@/components/atas/AttachmentsList"
import { AtaTranscriptionPanel } from "@/components/atas/AtaTranscriptionPanel"
import { AtaMinutaPanel } from "@/components/atas/AtaMinutaPanel"
import { FileUploader } from "@/components/atas/FileUploader"
import { CalendarDays, ChevronDown, Edit, FileAudio, FileText, LayoutList, Paperclip, UserRound, UsersRound } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useAtasStore } from "@/stores/atas.store"
import { useTagsStore } from "@/stores/tags.store"
import { supabase } from "@/integrations/supabase/client"
import { useEffect, useState, useCallback } from "react"
import { Ata, Attachment } from "@/data/types"
import { useEscapeKeyForAlert } from "@/hooks/useEscapeKeyForAlert"

const AtaDetail = () => {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const router = useRouter()
  const { getAtaById, addComment, updateComment, addAttachment, removeAttachment, removeComment, updateAta, statuses, loadStatuses } = useAtasStore()
  const { tags, loadTags } = useTagsStore()
  
  const [ata, setAta] = useState<Ata | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentLoading, setCommentLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [attachmentToDelete, setAttachmentToDelete] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('resumo')

  // Hook para fechar AlertDialog com ESC
  useEscapeKeyForAlert(() => setAttachmentToDelete(null), !!attachmentToDelete)

  const loadAta = useCallback(async () => {
    if (!id) return
    
    setLoading(true)
    const ataData = await getAtaById(id)
    setAta(ataData)
    setLoading(false)
  }, [id, getAtaById])

  // Trocar de ata sem remontar a página volta a mostrar o carregamento.
  const [loadingFor, setLoadingFor] = useState(id)
  if (loadingFor !== id) {
    setLoadingFor(id)
    setLoading(true)
  }

  // A carga inicial mora no efeito para poder ser cancelada: a resposta de uma
  // ata anterior não pode sobrescrever a atual. As ações da página recarregam
  // pelo loadAta.
  useEffect(() => {
    loadStatuses()
    loadTags()
    if (!id) return
    let cancelled = false
    getAtaById(id).then((ataData) => {
      if (cancelled) return
      setAta(ataData)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id, loadStatuses, loadTags, getAtaById])

  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`ata-status-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'omnia_atas',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const nextStatusId = (payload.new as { status_id?: string }).status_id
          if (!nextStatusId) return
          setAta(current => current?.id === id ? { ...current, statusId: nextStatusId } : current)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [id])

  const handleAddComment = async (body: string, attachments?: Attachment[]) => {
    if (!id) return
    
    setCommentLoading(true)
    await addComment(id, {
      body,
      attachments: attachments || []
    })
    
    await loadAta()
    setCommentLoading(false)
  }

  const handleAddAttachment = async (attachment: Omit<Attachment, 'id' | 'createdAt'>) => {
    if (!id) return
    
    setUploadLoading(true)
    await addAttachment(id, attachment)
    
    await loadAta()
    setUploadLoading(false)
  }

  const handleUpdateComment = async (commentId: string, body: string) => {
    if (!id) return
    
    setCommentLoading(true)
    await updateComment(id, commentId, body)
    
    await loadAta()
    setCommentLoading(false)
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!id) return
    
    setCommentLoading(true)
    await removeComment(id, commentId)
    
    await loadAta()
    setCommentLoading(false)
  }

  const handleEdit = () => {
    router.push(`/atas/${id}/edit`)
  }

  const handleStatusChange = async (statusId: string) => {
    if (!id || !ata) return
    
    try {
      await updateAta(id, { statusId })
      await loadAta()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando...</div>
        </div>
      </Layout>
    )
  }

  if (!ata) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-600">Ata não encontrada</div>
        </div>
      </Layout>
    )
  }

  const status = statuses.find(s => s.id === ata.statusId)
  const attachmentCount = (ata.attachments?.length ?? 0) + (ata.comments?.reduce(
    (total, comment) => total + (comment.attachments?.length ?? 0), 0,
  ) ?? 0)
  const meetingDate = ata.meetingDate
    ? new Date(ata.meetingDate + 'T00:00:00').toLocaleDateString('pt-BR')
    : null

  return (
    <Layout>
      <div className="min-w-0 space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Início", href: "/" },
            { label: "Atas", href: "/atas" },
            { label: ata.title }
          ]}
        />
        
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="min-w-0 break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{ata.title}</h1>
              {status && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-auto rounded-full p-0 hover:bg-transparent"
                      aria-label={`Alterar status: ${status.name}`}
                    >
                      <Badge variant="secondary" className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-2.5 py-1 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} aria-hidden="true" />
                        {status.name}
                        <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                      </Badge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {statuses.map((statusOption) => (
                      <DropdownMenuItem
                        key={statusOption.id}
                        onClick={() => handleStatusChange(statusOption.id)}
                        className="flex items-center gap-2"
                      >
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: statusOption.color }}
                          aria-hidden="true"
                        />
                        {statusOption.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {meetingDate && (
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Data da assembleia</dt>
                  <dd className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />{meetingDate}</dd>
                </div>
              )}
              {ata.secretary && (
                <div className="flex min-w-0 items-center gap-2">
                  <dt className="flex shrink-0 items-center gap-2"><UsersRound className="h-4 w-4" aria-hidden="true" />Secretário:</dt>
                  <dd className="min-w-0 break-words text-foreground">{ata.secretary.name}</dd>
                </div>
              )}
              {ata.responsible && (
                <div className="flex min-w-0 items-center gap-2">
                  <dt className="flex shrink-0 items-center gap-2"><UserRound className="h-4 w-4" aria-hidden="true" />Responsável:</dt>
                  <dd className="min-w-0 break-words text-foreground">{ata.responsible.name}</dd>
                </div>
              )}
            </dl>
          </div>

          <Button variant="outline" onClick={handleEdit} className="shrink-0 self-start">
            <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
            Editar dados
          </Button>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="min-w-0 overflow-x-auto pb-1">
            <TabsList aria-label="Seções da ata" className="min-w-max gap-4 sm:gap-6">
              <TabsTrigger value="resumo" className="gap-2"><LayoutList className="h-4 w-4" aria-hidden="true" />Resumo</TabsTrigger>
              <TabsTrigger value="transcricao" className="gap-2"><FileAudio className="h-4 w-4" aria-hidden="true" />Transcrição</TabsTrigger>
              <TabsTrigger value="minuta" className="gap-2"><FileText className="h-4 w-4" aria-hidden="true" />Minuta</TabsTrigger>
              <TabsTrigger value="anexos" className="gap-2"><Paperclip className="h-4 w-4" aria-hidden="true" />Anexos ({attachmentCount})</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="resumo" className="space-y-6">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-lg">Informações Gerais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <dl className="grid grid-cols-1 gap-x-8 gap-y-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  {ata.ticket && (
                    <div className="space-y-1 border-b pb-3">
                      <dt className="text-muted-foreground">Ticket</dt>
                      <dd className="break-words font-medium">{ata.ticket}</dd>
                    </div>
                  )}
                  
                  {meetingDate && (
                    <div className="space-y-1 border-b pb-3">
                      <dt className="text-muted-foreground">Data da Assembleia</dt>
                      <dd className="font-medium">{meetingDate}</dd>
                    </div>
                  )}
                  
                  {ata.secretary && (
                    <div className="space-y-1 border-b pb-3">
                      <dt className="text-muted-foreground">Secretário</dt>
                      <dd className="break-words font-medium">{ata.secretary.name}</dd>
                    </div>
                  )}
                  
                  {ata.responsible && (
                    <div className="space-y-1 border-b pb-3">
                      <dt className="text-muted-foreground">Responsável</dt>
                      <dd className="break-words font-medium">{ata.responsible.name}</dd>
                    </div>
                  )}
                </dl>
                
                {ata.tags && ata.tags.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Tags</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ata.tags.map((tagName) => {
                        const tagData = tags.find(t => t.name === tagName)
                        return (
                          <Badge key={tagName} variant="secondary" className="gap-1.5 border-none font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" style={{ backgroundColor: tagData?.color }} aria-hidden="true" />
                            {tagName}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-lg">Comentários ({ata.commentCount || 0})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <CommentInput 
                  onSubmit={handleAddComment} 
                  loading={commentLoading} 
                />
                
                <Separator />
                
                <CommentsList 
                  comments={ata.comments || []} 
                  onDeleteComment={handleDeleteComment}
                  onUpdateComment={handleUpdateComment}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transcricao">
            <AtaTranscriptionPanel key={ata.id} ataId={ata.id} onGenerateMinuta={() => setActiveTab('minuta')} />
          </TabsContent>

          <TabsContent value="minuta">
            <AtaMinutaPanel key={ata.id} ataId={ata.id} ataTitle={ata.title} onOpenTranscription={() => setActiveTab('transcricao')} />
          </TabsContent>

          <TabsContent value="anexos">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Adicionar Anexos</CardTitle>
                </CardHeader>
                <CardContent>
                  <FileUploader 
                    onUpload={handleAddAttachment}
                    loading={uploadLoading}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    maxSizeMB={10}
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Anexos da Ata</CardTitle>
                </CardHeader>
                <CardContent>
                  <AttachmentsList 
                    attachments={ata.attachments || []}
                    canDelete={true}
                    onDelete={(attachmentId) => {
                      setAttachmentToDelete(attachmentId)
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!attachmentToDelete} onOpenChange={() => setAttachmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover anexo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este anexo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                if (attachmentToDelete) {
                  const success = await removeAttachment(attachmentToDelete)
                  if (success) {
                    await loadAta()
                  }
                  setAttachmentToDelete(null)
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  )
}

export default AtaDetail
