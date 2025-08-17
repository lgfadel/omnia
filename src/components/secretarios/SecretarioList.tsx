import { useState } from "react"
import { Pencil, Trash2, Plus, User, Shield, Eye } from "lucide-react"
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
import { UserRef } from "@/data/fixtures"

interface SecretarioListProps {
  secretarios: UserRef[]
  onEdit: (secretario: UserRef) => void
  onDelete: (id: string) => void
  onCreate: () => void
  isLoading?: boolean
}

const getRoleIcon = (roles: string[]) => {
  if (roles.includes("ADMIN")) return <Shield className="w-4 h-4" />
  if (roles.includes("SECRETARIO")) return <User className="w-4 h-4" />
  return <Eye className="w-4 h-4" />
}

const getRoleLabels = (roles: string[]) => {
  return roles.map(role => {
    switch (role) {
      case "ADMIN": return "Admin"
      case "SECRETARIO": return "Secretário"
      case "USUARIO": return "Usuário"
      default: return role
    }
  }).join(", ")
}

const getRoleVariant = (roles: string[]) => {
  if (roles.includes("ADMIN")) return "destructive"
  if (roles.includes("SECRETARIO")) return "default"
  return "secondary"
}

export function SecretarioList({ secretarios, onEdit, onDelete, onCreate, isLoading }: SecretarioListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleDeleteClick = (id: string) => {
    setDeleteId(id)
  }

  const handleDeleteConfirm = () => {
    if (deleteId) {
      onDelete(deleteId)
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Usuários Cadastrados</h3>
        <Button onClick={onCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Usuário
        </Button>
      </div>

      <div className="grid gap-3">
        {secretarios.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Nenhum usuário encontrado</p>
            </CardContent>
          </Card>
        ) : (
          secretarios.map((secretario) => (
            <Card key={secretario.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{secretario.name}</span>
                      <Badge 
                        variant={getRoleVariant(secretario.roles) as any}
                        className="gap-1"
                      >
                        {getRoleIcon(secretario.roles)}
                        {getRoleLabels(secretario.roles)}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">{secretario.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(secretario)}
                    disabled={isLoading}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(secretario.id)}
                    disabled={isLoading}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
              Todas as atas vinculadas a este usuário serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}