import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { Layout } from "@/components/layout/Layout"
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia"
import { SecretarioForm } from "@/components/secretarios/SecretarioForm"
import { SecretarioList } from "@/components/secretarios/SecretarioList"
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useSecretariosStore } from "@/store/secretarios.store"
import { UserRef } from "@/data/fixtures"
import { useEscapeKeyForAlert } from "@/hooks/useEscapeKeyForAlert"

const ConfigUsuarios = () => {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSecretario, setEditingSecretario] = useState<UserRef | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const { toast } = useToast()

  // Hook para fechar AlertDialog com ESC
  useEscapeKeyForAlert(() => setTempPassword(null), !!tempPassword)
  
  const {
    secretarios,
    loading,
    error,
    loadSecretarios,
    createSecretario,
    updateSecretario,
    deleteSecretario,
    clearError
  } = useSecretariosStore()

  useEffect(() => {
    loadSecretarios()
  }, [loadSecretarios])

  useEffect(() => {
    if (error) {
      toast({
        title: "Erro",
        description: error,
        variant: "destructive"
      })
      clearError()
    }
  }, [error, toast, clearError])

  const handleCreate = () => {
    setEditingSecretario(null)
    setIsFormOpen(true)
  }

  const handleEdit = (secretario: UserRef) => {
    setEditingSecretario(secretario)
    setIsFormOpen(true)
  }

  const handleSubmit = async (data: any) => {
    try {
      if (editingSecretario) {
        await updateSecretario(editingSecretario.id, data)
        toast({
          title: "Sucesso",
          description: "Usuário atualizado com sucesso!"
        })
      } else {
        const result = await createSecretario(data)
        
        // Show temp password if generated
        if (result.tempPassword) {
          setTempPassword(result.tempPassword)
        }
        
        toast({
          title: "Sucesso", 
          description: `Usuário criado com sucesso! ${data.password ? '' : 'Uma senha temporária foi gerada.'}`
        })
      }
      setIsFormOpen(false)
      setEditingSecretario(null)
    } catch (error) {
      // Error is handled by the store and useEffect above
    }
  }

  const handleDelete = async (id: string) => {
    const success = await deleteSecretario(id)
    if (success) {
      toast({
        title: "Sucesso",
        description: "Usuário excluído com sucesso!"
      })
    }
    // Em caso de falha, o useEffect exibirá a mensagem de erro detalhada do store
  }

  const handleCancel = () => {
    setIsFormOpen(false)
    setEditingSecretario(null)
  }

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Configurações", href: "/config" },
            { label: "Usuários", isActive: true }
          ]} 
        />
        
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configuração de Usuários</h1>
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <SecretarioList
              secretarios={secretarios}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCreate={handleCreate}
              isLoading={loading}
            />
          </div>
          
          {isFormOpen && (
            <div className="w-96">
              <SecretarioForm
                secretario={editingSecretario || undefined}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                isLoading={loading}
              />
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!tempPassword} onOpenChange={() => setTempPassword(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Senha Temporária Gerada</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Uma senha temporária foi gerada para o usuário:</p>
              <div className="bg-muted p-3 rounded font-mono text-sm">
                {tempPassword}
              </div>
              <p className="text-xs text-muted-foreground">
                Anote esta senha e compartilhe com o usuário. Ele deverá alterá-la no primeiro acesso.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={() => setTempPassword(null)}>
            Entendi
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default ConfigUsuarios;