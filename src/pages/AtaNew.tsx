import { Layout } from "@/components/layout/Layout"
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia"
import { AtaForm } from "@/components/atas/AtaForm"
import { useNavigate } from "react-router-dom"
import { useAtasStore } from "@/store/atas.store"

import { useEffect } from "react"
import { useToast } from "@/hooks/use-toast"

const AtaNew = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { createAta, loadStatuses, statuses, loading } = useAtasStore()

  useEffect(() => {
    loadStatuses()
  }, [loadStatuses])

  const handleSubmit = async (data: any) => {
    try {
      const secretary = data.secretaryId ? { id: data.secretaryId, name: '', email: '', roles: [] } : undefined
      const responsible = data.responsibleId ? { id: data.responsibleId, name: '', email: '', roles: [] } : undefined

      const newAta = await createAta({
        title: data.title,
        description: data.description,
        meetingDate: data.meetingDate,
        secretary,
        responsible,
        statusId: data.statusId,
        condominiumId: data.condominiumId,
        ticket: data.ticket,
        tags: data.tags,
        attachments: [],
        comments: []
      })

      toast({
        title: "Ata criada com sucesso!",
        description: `A ata "${newAta.title}" foi criada e está disponível na lista.`,
      })

      navigate('/atas')
    } catch (error) {
      console.error('Erro ao criar ata:', error)
      toast({
        title: "Erro ao criar ata",
        description: "Ocorreu um erro ao criar a ata. Tente novamente.",
        variant: "destructive"
      })
    }
  }

  const handleCancel = () => {
    navigate('/atas')
  }

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Atas", href: "/atas" },
            { label: "Nova Ata", isActive: true }
          ]} 
        />
        
        <div className="max-w-4xl mx-auto">
          <AtaForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        </div>
      </div>
    </Layout>
  )
}

export default AtaNew