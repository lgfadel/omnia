import { useState } from "react"
import { Pencil, Trash2, Plus, GripVertical } from "lucide-react"
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
import { TarefaStatus } from "@/repositories/tarefaStatusRepo.supabase"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import {
  CSS
} from '@dnd-kit/utilities'

interface TicketStatusListProps {
  statuses: TarefaStatus[]
  onEdit: (status: TarefaStatus) => void
  onDelete: (id: string) => void
  onCreate: () => void
  onReorder: (statuses: TarefaStatus[]) => void
  isLoading?: boolean
}

interface SortableTicketStatusItemProps {
  status: TarefaStatus
  onEdit: (status: TarefaStatus) => void
  onDelete: (id: string) => void
  isLoading?: boolean
}

function SortableTicketStatusItem({ status, onEdit, onDelete, isLoading }: SortableTicketStatusItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: status.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="flex items-center justify-between py-3 px-4 border rounded-lg bg-white mb-2">
        <div className="flex items-center gap-3 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 cursor-grab active:cursor-grabbing"
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </Button>

          <span 
            className="font-medium"
            style={{ color: status.color }}
          >
            {status.name}
          </span>
          
          {status.isDefault && (
            <span className="text-sm text-gray-500">Padrão</span>
          )}
          
          <span className="text-sm text-gray-400">
            Ordem: {status.order}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-gray-600"
            onClick={() => onEdit(status)}
            disabled={isLoading}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          {!status.isDefault && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-red-500"
              onClick={() => onDelete(status.id)}
              disabled={isLoading}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function TicketStatusList({ 
  statuses, 
  onEdit, 
  onDelete, 
  onCreate, 
  onReorder, 
  isLoading 
}: TicketStatusListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [statusToDelete, setStatusToDelete] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDeleteClick = (id: string) => {
    setStatusToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (statusToDelete) {
      onDelete(statusToDelete)
      setDeleteDialogOpen(false)
      setStatusToDelete(null)
    }
  }

  const handleDragEnd = (event: any) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = statuses.findIndex((status) => status.id === active.id)
      const newIndex = statuses.findIndex((status) => status.id === over.id)

      const newOrder = arrayMove(statuses, oldIndex, newIndex)
      
      // Update order property for each status
      const reorderedStatuses = newOrder.map((status, index) => ({
        ...status,
        order: index + 1
      }))
      
      onReorder(reorderedStatuses)
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg border">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Status Cadastrados</h2>
          <Button 
            onClick={onCreate} 
            className="bg-blue-500 hover:bg-blue-600 text-white"
            disabled={isLoading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Status
          </Button>
        </div>
        <div className="p-6">
          {statuses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum status configurado</p>
              <p className="text-sm mt-1">Clique em "Novo Status" para criar o primeiro status</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={statuses} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {statuses.map((status) => (
                    <SortableTicketStatusItem
                      key={status.id}
                      status={status}
                      onEdit={onEdit}
                      onDelete={handleDeleteClick}
                      isLoading={isLoading}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este status? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}