import { useState } from "react"
import { Pencil, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Condominium } from "@/repositories/condominiumsRepo.supabase"
import { useEscapeKeyForAlert } from "@/hooks/useEscapeKeyForAlert"

interface CondominiumListProps {
  condominiums: Condominium[]
  onEdit: (condominium: Condominium) => void
  onDelete: (id: string) => void
  onCreate: () => void
  isLoading?: boolean
}

export function CondominiumList({ condominiums, onEdit, onDelete, onCreate, isLoading }: CondominiumListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [condominiumToDelete, setCondominiumToDelete] = useState<Condominium | null>(null)

  useEscapeKeyForAlert(() => setDeleteDialogOpen(false), deleteDialogOpen)

  const handleDeleteClick = (condominium: Condominium) => {
    setCondominiumToDelete(condominium)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (condominiumToDelete) {
      onDelete(condominiumToDelete.id)
      setDeleteDialogOpen(false)
      setCondominiumToDelete(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setCondominiumToDelete(null)
  }

  // Função para formatar CNPJ para exibição
  const formatCNPJDisplay = (cnpj?: string): string => {
    if (!cnpj) return 'Não informado'
    const cleanCNPJ = cnpj.replace(/[^\d]/g, '')
    if (cleanCNPJ.length !== 14) return cnpj
    return cleanCNPJ
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Condomínios Cadastrados</h3>
        <Button onClick={onCreate} disabled={isLoading}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Condomínio
        </Button>
      </div>

      {condominiums.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Nenhum condomínio cadastrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {condominiums.map((condominium) => (
            <Card key={condominium.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <h4 className="font-medium text-foreground">{condominium.name}</h4>
                      <div className="flex flex-col gap-1 mt-1">
                        <p className="text-sm text-muted-foreground">
                          CNPJ: {formatCNPJDisplay(condominium.cnpj)}
                        </p>
                        {condominium.address && (
                          <p className="text-sm text-muted-foreground">
                            {condominium.address}
                          </p>
                        )}
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          {condominium.phone && (
                            <span>Tel: {condominium.phone}</span>
                          )}
                          {condominium.whatsapp && (
                            <span>WhatsApp: {condominium.whatsapp}</span>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>Síndico: {condominium.syndic_name || 'Não definido'}</span>
                          <span>Gerente: {condominium.manager_name || 'Não definido'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(condominium)}
                    disabled={isLoading}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(condominium)}
                    disabled={isLoading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o condomínio "{condominiumToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}