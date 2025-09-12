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
import { Status } from "@/data/types"
import { useEscapeKeyForAlert } from "@/hooks/useEscapeKeyForAlert"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
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

interface CrmStatusListProps {
  statuses: Status[]
  onEdit: (status: Status) => void
  onDelete: (id: string) => void
  onCreate: () => void
  onReorder: (statuses: Status[]) => void
  isLoading?: boolean
}

interface SortableCrmStatusItemProps {
  status: Status
  onEdit: (status: Status) => void
  onDelete: (id: string) => void
  isLoading?: boolean
}

function SortableCrmStatusItem({ status, onEdit, onDelete, isLoading }: SortableCrmStatusItemProps) {
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
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <Card ref={setNodeRef} style={style}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <GripVertical 
            className="w-4 h-4 text-muted-foreground cursor-move" 
            {...attributes}
            {...listeners}
          />
          <Badge 
            variant="secondary" 
            style={{ backgroundColor: status.color + '20', color: status.color }}
            className="border-0"
          >
            {status.name}
          </Badge>
          {status.isDefault && (
            <Badge variant="outline" className="text-xs">
              Padrão
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            Ordem: {status.order}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(status)}
            disabled={isLoading}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          
          {!status.isDefault && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(status.id)}
              disabled={isLoading}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function CrmStatusList({ statuses, onEdit, onDelete, onCreate, onReorder, isLoading }: CrmStatusListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Hook para fechar AlertDialog com ESC
  useEscapeKeyForAlert(() => setDeleteId(null), !!deleteId)
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = statuses.findIndex((status) => status.id === active.id)
      const newIndex = statuses.findIndex((status) => status.id === over?.id)
      
      const reorderedStatuses = arrayMove(statuses, oldIndex, newIndex)
      onReorder(reorderedStatuses)
    }
  }

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
        <h3 className="text-lg font-medium">Status do CRM Cadastrados</h3>
        <Button onClick={onCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Status
        </Button>
      </div>

      <div className="grid gap-3">
        {statuses.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Nenhum status encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={statuses.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {statuses.map((status) => (
                <SortableCrmStatusItem
                  key={status.id}
                  status={status}
                  onEdit={onEdit}
                  onDelete={handleDeleteClick}
                  isLoading={isLoading}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este status? Esta ação não pode ser desfeita.
              Todos os leads do CRM com este status serão afetados.
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