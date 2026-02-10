"use client";

import { Layout } from "@/components/layout/Layout"
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia"
import { AtaForm } from "@/components/atas/AtaForm"
import { useRouter } from "next/navigation"
import { useAtasStore } from "@/stores/atas.store"
import { useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { handleSupabaseError, createErrorContext } from "@/lib/errorHandler"

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

const AtaNew = () => {
  const router = useRouter()
  const { toast } = useToast()
  const { createAta, loadStatuses, statuses, loading } = useAtasStore()

  useEffect(() => {
    loadStatuses()
  }, [loadStatuses])

  const handleSubmit = async (data: Omit<AtaFormData, 'tags'> & { tags: string[] }) => {
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

      router.push('/atas')
    } catch (error) {
      console.error('Erro ao criar ata:', error)
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('create', 'ata', 'omnia_atas')
      )
      toast({
        title: "Erro ao criar ata",
        description: treatedError.message,
        variant: "destructive"
      })
    }
  }

  const handleCancel = () => {
    router.push('/atas')
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
