import { Layout } from "@/components/layout/Layout"
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { CommentsList } from "@/components/atas/CommentsList"
import { CommentInput } from "@/components/atas/CommentInput"
import { AttachmentsList } from "@/components/atas/AttachmentsList"
import { MockUploader } from "@/components/atas/MockUploader"
import { Edit, FileDown, Archive, Calendar, User, Clock } from "lucide-react"
import { useParams, useNavigate } from "react-router-dom"
import { useAtasStore } from "@/store/atas.store"
import { useEffect, useState } from "react"
import { Ata, FIXTURE_USERS } from "@/data/fixtures"

const AtaDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getAtaById, addComment, addAttachment, statuses, loadStatuses } = useAtasStore()
  
  const [ata, setAta] = useState<Ata | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentLoading, setCommentLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)

  useEffect(() => {
    loadStatuses()
    if (id) {
      loadAta()
    }
  }, [id, loadStatuses])

  const loadAta = async () => {
    if (!id) return
    
    setLoading(true)
    const ataData = await getAtaById(id)
    setAta(ataData)
    setLoading(false)
  }

  const handleAddComment = async (body: string, attachments?: any[]) => {
    if (!id) return
    
    setCommentLoading(true)
    await addComment(id, {
      author: FIXTURE_USERS[0], // Mock current user
      body,
      attachments: attachments || []
    })
    
    // Reload ata to get updated comments
    await loadAta()
    setCommentLoading(false)
  }

  const handleAddAttachment = async (attachment: any) => {
    if (!id) return
    
    setUploadLoading(true)
    await addAttachment(id, attachment)
    
    // Reload ata to get updated attachments
    await loadAta()
    setUploadLoading(false)
  }

  const handleEdit = () => {
    navigate(`/atas/${id}/edit`)
  }

  const handleExportPDF = () => {
    // Mock PDF export
    alert("Funcionalidade de exportação PDF será implementada em fase posterior")
  }

  const handleArchive = () => {
    // Mock archive functionality
    alert("Funcionalidade de arquivamento será implementada em fase posterior")
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Carregando ata...</div>
        </div>
      </Layout>
    )
  }

  if (!ata) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <h2 className="text-xl font-semibold mb-2">Ata não encontrada</h2>
          <p className="text-muted-foreground mb-4">A ata solicitada não existe ou foi removida.</p>
          <Button onClick={() => navigate('/atas')}>Voltar para lista</Button>
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
            { label: "Atas", href: "/atas" },
            { label: ata.title, isActive: true }
          ]} 
        />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{ata.title}</h1>
              {status && (
                <Badge 
                  variant="secondary"
                  style={{ backgroundColor: status.color + '20', color: status.color }}
                >
                  {status.name}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{ata.description}</p>
            
          </div>
          
          <div className="flex items-center gap-2">
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
              Anexos ({ata.attachments?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo">

            {/* Two main boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações Gerais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="font-medium text-muted-foreground">Data de Criação</label>
                      <p className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {new Date(ata.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    
                    {ata.meetingDate && (
                      <div>
                        <label className="font-medium text-muted-foreground">Data da Assembleia</label>
                        <p className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {new Date(ata.meetingDate).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    )}
                    
                    {ata.ticket && (
                      <div>
                        <label className="font-medium text-muted-foreground">Ticket</label>
                        <p>{ata.ticket}</p>
                      </div>
                    )}
                    
                    <div>
                      <label className="font-medium text-muted-foreground">Última Atualização</label>
                      <p>{new Date(ata.updatedAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  
                  {ata.tags && ata.tags.length > 0 && (
                    <div>
                      <label className="font-medium text-muted-foreground">Tags</label>
                      <div className="flex gap-1 mt-1">
                        {ata.tags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Responsabilidades</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ata.secretary && (
                    <div>
                      <label className="font-medium text-muted-foreground">Secretário</label>
                      <p className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {ata.secretary.name}
                      </p>
                      <p className="text-sm text-muted-foreground">{ata.secretary.email}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Comments section - always visible */}
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
                
                <CommentsList comments={ata.comments || []} />
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
                  <MockUploader 
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
                    onDelete={(id) => {
                      // Mock delete - would remove from attachments
                      alert("Funcionalidade de remoção será implementada")
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Atividades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-3 pb-4 border-b">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">Ata criada</span> por Sistema
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(ata.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  
                  {ata.updatedAt !== ata.createdAt && (
                    <div className="flex gap-3 pb-4 border-b">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                      <div>
                        <p className="text-sm">
                          <span className="font-medium">Ata atualizada</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(ata.updatedAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-sm text-muted-foreground">
                    Histórico detalhado será implementado em fase posterior com logs de auditoria.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}

export default AtaDetail