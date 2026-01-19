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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Condomínios</h2>
          <p className="text-sm text-gray-600">
            {condominiums.length} condomínio{condominiums.length !== 1 ? 's' : ''} cadastrado{condominiums.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={onCreate} disabled={isLoading}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Condomínio
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">Carregando condomínios...</div>
        </div>
      ) : condominiums.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-500">
              <Plus className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Nenhum condomínio cadastrado</h3>
              <p className="text-sm mb-4">
                Comece criando seu primeiro condomínio.
              </p>
              <Button onClick={onCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Condomínio
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div>
          {condominiums.map((condominium) => (
            <Card key={condominium.id} className="mb-3">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{condominium.name}</h3>
                        <div className="text-sm text-gray-500">
                          {condominium.address && (
                            <div>{condominium.address}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(condominium)}
                      disabled={isLoading}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(condominium)}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
