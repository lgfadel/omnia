import { useEffect, useState } from "react"
import { Layout } from "@/components/layout/Layout"
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia"
import { AdminList } from "@/components/administradoras/AdminList"
import { AdminForm } from "@/components/administradoras/AdminForm"
import { useAdministradorasStore } from "@/store/administradoras.store"
import { useToast } from "@/hooks/use-toast"
import { Administradora } from "@/repositories/administradorasRepo.supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const ConfigAdministradoras = () => {
  const { toast } = useToast()
  const {
    administradoras,
    loading,
    error,
    loadAdministradoras,
    createAdministradora,
    updateAdministradora,
    deleteAdministradora,
    clearError
  } = useAdministradorasStore()
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAdministradora, setEditingAdministradora] = useState<Administradora | null>(null)

  useEffect(() => {
    console.log('ConfigAdministradoras: Component mounted, loading administradoras...')
    loadAdministradoras()
  }, [loadAdministradoras])

  useEffect(() => {
    if (error) {
      console.error('ConfigAdministradoras: Error detected:', error)
      toast({
        title: "Erro",
        description: error,
        variant: "destructive"
      })
      clearError()
    }
  }, [error, toast, clearError])

  const handleCreate = () => {
    console.log('ConfigAdministradoras: Opening create form')
    setEditingAdministradora(null)
    setIsFormOpen(true)
  }

  const handleEdit = (administradora: Administradora) => {
    console.log('ConfigAdministradoras: Opening edit form for administradora:', administradora)
    setEditingAdministradora(administradora)
    setIsFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    console.log('ConfigAdministradoras: Deleting administradora:', id)
    
    try {
      await deleteAdministradora(id)
      toast({
        title: "Administradora excluída!",
        description: "A administradora foi excluída com sucesso."
      })
    } catch (error) {
      console.error('ConfigAdministradoras: Error deleting administradora:', error)
      toast({
        title: "Erro",
        description: "Erro ao excluir administradora",
        variant: "destructive"
      })
    }
  }

  const handleFormSubmit = async (data: Omit<Administradora, 'id' | 'created_at' | 'updated_at'>) => {
    console.log('ConfigAdministradoras: Submitting form:', data)
    
    try {
      if (editingAdministradora) {
        await updateAdministradora(editingAdministradora.id, data)
        toast({
          title: "Administradora atualizada!",
          description: `A administradora "${data.nome}" foi atualizada com sucesso.`
        })
      } else {
        await createAdministradora(data)
        toast({
          title: "Administradora criada!",
          description: `A administradora "${data.nome}" foi criada com sucesso.`
        })
      }
      setIsFormOpen(false)
      setEditingAdministradora(null)
    } catch (error) {
      console.error('ConfigAdministradoras: Error submitting form:', error)
      toast({
        title: "Erro",
        description: editingAdministradora ? "Erro ao atualizar administradora" : "Erro ao criar administradora",
        variant: "destructive"
      })
    }
  }

  const handleFormCancel = () => {
    console.log('ConfigAdministradoras: Form cancelled')
    setIsFormOpen(false)
    setEditingAdministradora(null)
  }

  const breadcrumbItems = [
    { label: "Configurações", href: "/config" },
    { label: "Administradoras", isActive: true }
  ]

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <BreadcrumbOmnia items={breadcrumbItems} />
        
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold text-foreground">
            Configuração de Administradoras
          </h1>
          
          <AdminList
            administradoras={administradoras}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreate={handleCreate}
            isLoading={loading}
          />
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAdministradora ? "Editar Administradora" : "Nova Administradora"}
            </DialogTitle>
          </DialogHeader>
          <AdminForm
            administradora={editingAdministradora || undefined}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
            isLoading={loading}
          />
        </DialogContent>
      </Dialog>
    </Layout>
  )
}

export default ConfigAdministradoras