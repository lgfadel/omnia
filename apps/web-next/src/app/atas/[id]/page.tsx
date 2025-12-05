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
import { FileUploader } from "@/components/atas/FileUploader"
import { Edit, FileDown, Archive, Clock, ChevronDown } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useAtasStore } from "@/store/atas.store"
import { useTagsStore } from "@/store/tags.store"
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

  // Hook para fechar AlertDialog com ESC
  useEscapeKeyForAlert(() => setAttachmentToDelete(null), !!attachmentToDelete)

  const loadAta = useCallback(async () => {
    if (!id) return
    
    setLoading(true)
    const ataData = await getAtaById(id)
    setAta(ataData)
    setLoading(false)
  }, [id, getAtaById])

  useEffect(() => {
    loadStatuses()
    loadTags()
    if (id) {
      loadAta()
    }
  }, [id, loadStatuses, loadTags, loadAta])

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

  const handleExportPDF = () => {
    alert("Funcionalidade de exportação será implementada")
  }

  const handleArchive = () => {
    alert("Funcionalidade de arquivamento será implementada")
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

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Início", href: "/" },
            { label: "Atas", href: "/atas" },
            { label: ata.title }
          ]}
        />
        
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{ata.title}</h1>
            {status && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 hover:bg-transparent"
                  >
                    <Badge 
                      style={{ backgroundColor: status.color, color: 'white' }}
                      className="border-none cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
                    >
                      {status.name}
                      <ChevronDown className="w-3 h-3" />
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
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: statusOption.color }}
                      />
                      {statusOption.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
              <FileDown className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
            <Button variant="outline" onClick={handleArchive}>
              <Archive className="w-4 h-4 mr-2" />
              Arquivar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="resumo" className="space-y-6">
          <TabsList>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="anexos">
              Anexos ({(() => {
                const directAttachments = ata.attachments?.length || 0;
                const commentAttachments = ata.comments?.reduce((total, comment) => 
                  total + (comment.attachments?.length || 0), 0) || 0;
                return directAttachments + commentAttachments;
              })()})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumo">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações Gerais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-6 text-sm">
                  {ata.ticket && (
                    <div>
                      <label className="font-medium text-muted-foreground">Ticket</label>
                      <p>{ata.ticket}</p>
                    </div>
                  )}
                  
                  {ata.meetingDate && (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <label className="font-semibold text-blue-800">Data da Assembleia</label>
                      <p className="flex items-center gap-2 text-blue-700 font-medium">
                        {new Date(ata.meetingDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  )}
                  
                  {ata.secretary && (
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <label className="font-semibold text-green-800">Secretário</label>
                      <p className="flex items-center gap-2 text-green-700 font-medium">
                        {ata.secretary.name}
                      </p>
                    </div>
                  )}
                  
                  {ata.responsible && (
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                      <label className="font-semibold text-purple-800">Responsável</label>
                      <p className="flex items-center gap-2 text-purple-700 font-medium">
                        {ata.responsible.name}
                      </p>
                    </div>
                  )}
                </div>
                
                {ata.tags && ata.tags.length > 0 && (
                  <div>
                    <label className="font-medium text-muted-foreground">Tags</label>
                    <div className="flex gap-1 mt-1">
                      {ata.tags.map((tagName) => {
                        const tagData = tags.find(t => t.name === tagName)
                        return (
                          <Badge 
                            key={tagName} 
                            style={{ 
                              backgroundColor: tagData?.color || '#6366f1', 
                              color: 'white' 
                            }}
                            className="border-none"
                          >
                            {tagName}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
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
