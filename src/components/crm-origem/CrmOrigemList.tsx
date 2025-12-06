import { useState } from "react"
import { Pencil, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { CrmOrigem } from "@/repositories/crmOrigensRepo.supabase"
import { useEscapeKeyForAlert } from "@/hooks/useEscapeKeyForAlert"

interface CrmOrigemListProps {
  origens: CrmOrigem[]
  onEdit: (origem: CrmOrigem) => void
  onDelete: (id: string) => void
  onCreate: () => void
  isLoading?: boolean
}

interface CrmOrigemItemProps {
  origem: CrmOrigem
  onEdit: (origem: CrmOrigem) => void
  onDelete: (id: string) => void
  isLoading?: boolean
}

function CrmOrigemItem({ origem, onEdit, onDelete, isLoading }: CrmOrigemItemProps) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-3">
        <Badge 
          style={{ 
            backgroundColor: origem.color + '20',
            color: origem.color,
            borderColor: origem.color + '40'
          }}
          className="border"
        >
          {origem.name}
        </Badge>
        {origem.isDefault && (
          <Badge variant="secondary" className="text-xs">
            Padrão
          </Badge>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(origem)}
          disabled={isLoading}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(origem.id)}
          disabled={isLoading || origem.isDefault}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function CrmOrigemList({ origens, onEdit, onDelete, onCreate, isLoading }: CrmOrigemListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Hook para fechar AlertDialog com ESC
  useEscapeKeyForAlert(() => setDeleteId(null), !!deleteId)

  const handleDelete = (id: string) => {
    setDeleteId(id)
  }

  const confirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId)
      setDeleteId(null)
    }
  }

  const origemToDelete = origens.find(o => o.id === deleteId)

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Origens do Lead</CardTitle>
          <Button onClick={onCreate} disabled={isLoading}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Origem
          </Button>
        </CardHeader>
        <CardContent>
          {origens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma origem cadastrada
            </div>
          ) : (
            <div className="space-y-3">
              {origens.map((origem) => (
                <CrmOrigemItem
                  key={origem.id}
                  origem={origem}
                  onEdit={onEdit}
                  onDelete={handleDelete}
                  isLoading={isLoading}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a origem "{origemToDelete?.name}"?
              {origemToDelete?.isDefault && (
                <span className="block mt-2 text-red-600 font-medium">
                  Atenção: Esta é uma origem padrão e não pode ser excluída.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={origemToDelete?.isDefault}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}