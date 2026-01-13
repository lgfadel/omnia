'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { AdmissaoStatus } from '@/repositories/admissaoStatusRepo.supabase';

interface SortableStatusItemProps {
  status: AdmissaoStatus;
  onEdit: (status: AdmissaoStatus) => void;
  onDeleteClick: (status: AdmissaoStatus) => void;
}

function SortableStatusItem({ status, onEdit, onDeleteClick }: SortableStatusItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'shadow-lg opacity-50' : ''}`}
    >
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          <Badge
            style={{
              backgroundColor: status.color,
              color: 'white',
            }}
          >
            {status.name}
          </Badge>
          {status.isDefault && (
            <span className="text-xs text-muted-foreground">(Padrão)</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(status)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDeleteClick(status)}
            disabled={status.isDefault}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface AdmissaoStatusListProps {
  statuses: AdmissaoStatus[];
  onEdit: (status: AdmissaoStatus) => void;
  onDelete: (id: string) => void;
  onReorder: (statuses: AdmissaoStatus[]) => void;
}

export function AdmissaoStatusList({ statuses, onEdit, onDelete, onReorder }: AdmissaoStatusListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusToDelete, setStatusToDelete] = useState<AdmissaoStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = statuses.findIndex((s) => s.id === active.id);
      const newIndex = statuses.findIndex((s) => s.id === over.id);
      
      const reorderedStatuses = arrayMove(statuses, oldIndex, newIndex).map((item, index) => ({
        ...item,
        order: index + 1,
      }));

      onReorder(reorderedStatuses);
    }
  };

  const handleDeleteClick = (status: AdmissaoStatus) => {
    setStatusToDelete(status);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (statusToDelete) {
      onDelete(statusToDelete.id);
    }
    setDeleteDialogOpen(false);
    setStatusToDelete(null);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={statuses.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {statuses.map((status) => (
              <SortableStatusItem
                key={status.id}
                status={status}
                onEdit={onEdit}
                onDeleteClick={handleDeleteClick}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o status &quot;{statusToDelete?.name}&quot;?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
