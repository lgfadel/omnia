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

// Função para formatar telefone
const formatPhone = (value: string) => {
  if (!value) return value;
  
  const numericValue = value.replace(/\D/g, '').substring(0, 11); // Limita a 11 dígitos
  
  // Para números com 10 dígitos: (43) 9999-9999
  if (numericValue.length === 10) {
    return numericValue.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  // Para números com 11 dígitos: (43) 99999-9999
  else if (numericValue.length === 11) {
    return numericValue.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  // Para números incompletos, formatar conforme o que foi digitado
  else if (numericValue.length > 6) {
    if (numericValue.length <= 10) {
      return numericValue.replace(/(\d{2})(\d{0,4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    } else {
      return numericValue.replace(/(\d{2})(\d{0,5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    }
  }
  else if (numericValue.length > 2) {
    return numericValue.replace(/(\d{2})(\d{0,5})/, '($1) $2');
  }
  else if (numericValue.length > 0) {
    return numericValue.replace(/(\d{0,2})/, '($1');
  }
  
  return numericValue;
};

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
                          <div className="flex gap-4 mt-1">
                            {condominium.phone && (
                              <span>Tel: {formatPhone(condominium.phone)}</span>
                            )}
                            {condominium.whatsapp && (
                              <span>WhatsApp: {formatPhone(condominium.whatsapp)}</span>
                            )}
                          </div>
                          <div className="flex gap-4 mt-1">
                            <span>Síndico: {condominium.syndic_name || 'Não definido'}</span>
                            <span>Gerente: {condominium.manager_name || 'Não definido'}</span>
                          </div>
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