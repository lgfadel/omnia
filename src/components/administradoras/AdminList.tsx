import { useState } from "react"
import { Pencil, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Administradora } from "@/repositories/administradorasRepo.supabase"
import { useEscapeKeyForAlert } from "@/hooks/useEscapeKeyForAlert"

interface AdminListProps {
  administradoras: Administradora[]
  onEdit: (administradora: Administradora) => void
  onDelete: (id: string) => void
  onCreate: () => void
  isLoading?: boolean
}

interface AdminItemProps {
  administradora: Administradora
  onEdit: (administradora: Administradora) => void
  onDelete: (id: string) => void
  isLoading?: boolean
}

function AdminItem({ administradora, onEdit, onDelete, isLoading }: AdminItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  useEscapeKeyForAlert(() => setShowDeleteDialog(false), showDeleteDialog)

  const handleDelete = () => {
    onDelete(administradora.id)
    setShowDeleteDialog(false)
  }

  return (
    <>
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-medium text-gray-900">{administradora.nome}</h3>
                  <div className="text-sm text-gray-500">
                    Status: {administradora.ativo ? 'Ativo' : 'Inativo'}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(administradora)}
                disabled={isLoading}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a administradora "{administradora.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function AdminList({ administradoras, onEdit, onDelete, onCreate, isLoading }: AdminListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Administradoras</h2>
          <p className="text-sm text-gray-600">
            {administradoras.length} administradora{administradoras.length !== 1 ? 's' : ''} cadastrada{administradoras.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={onCreate} disabled={isLoading}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Administradora
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">Carregando administradoras...</div>
        </div>
      ) : administradoras.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-500">
              <Plus className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Nenhuma administradora cadastrada</h3>
              <p className="text-sm mb-4">
                Comece criando sua primeira administradora.
              </p>
              <Button onClick={onCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Administradora
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div>
          {administradoras.map((administradora) => (
            <AdminItem
              key={administradora.id}
              administradora={administradora}
              onEdit={onEdit}
              onDelete={onDelete}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}
    </div>
  )
}