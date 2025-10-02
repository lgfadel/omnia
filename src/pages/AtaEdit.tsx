import { Layout } from "@/components/layout/Layout"
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia"
import { AtaForm } from "@/components/atas/AtaForm"
import { Button } from "@/components/ui/button"
import { useParams, useNavigate } from "react-router-dom"
import { useAtasStore } from "@/store/atas.store"

import { useEffect, useState, useCallback } from "react"
import { Ata } from "@/data/types"

// Type for AtaForm data
type AtaFormData = {
  title: string;
  description?: string;
  meetingDate?: string;
  secretaryId?: string;
  responsibleId?: string;
  statusId: string;
  condominiumId?: string;
  ticket?: string;
  tags?: string;
}

const AtaEdit = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getAtaById, updateAta, loadStatuses, loading } = useAtasStore()
  
  const [ata, setAta] = useState<Ata | null>(null)
  const [loadingAta, setLoadingAta] = useState(true)

  const loadAta = useCallback(async () => {
    if (!id) return
    
    setLoadingAta(true)
    const ataData = await getAtaById(id)
    setAta(ataData)
    setLoadingAta(false)
  }, [id, getAtaById])

  useEffect(() => {
    loadStatuses()
    if (id) {
      loadAta()
    }
  }, [id, loadStatuses, loadAta])

  const handleSubmit = async (data: Omit<AtaFormData, 'tags'> & { tags: string[] }) => {
    if (!id) return
    
    try {
      const secretary = data.secretaryId ? { id: data.secretaryId, name: '', email: '', roles: [] } : undefined
      const responsible = data.responsibleId ? { id: data.responsibleId, name: '', email: '', roles: [] } : undefined

      await updateAta(id, {
        title: data.title,
        description: data.description,
        meetingDate: data.meetingDate,
        secretary,
        responsible,
        statusId: data.statusId,
        condominiumId: data.condominiumId,
        ticket: data.ticket,
        tags: data.tags
      })

      navigate(`/atas/${id}`)
    } catch (error) {
      console.error('Erro ao atualizar ata:', error)
    }
  }

  const handleCancel = () => {
    navigate(`/atas/${id}`)
  }

  if (loadingAta) {
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

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Atas", href: "/atas" },
            { label: ata.title, href: `/atas/${id}` },
            { label: "Editar", isActive: true }
          ]} 
        />
        
        <div className="max-w-4xl mx-auto">
          <AtaForm
            ata={ata}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        </div>
      </div>
    </Layout>
  )
}

export default AtaEdit