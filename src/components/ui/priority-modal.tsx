import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Flag } from 'lucide-react'
import { TarefaPrioridade } from '@/repositories/tarefasRepo.supabase'
import { PriorityBadge } from '@/components/ui/priority-badge'
import { cn } from '@/lib/utils'

interface PriorityModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (priority: TarefaPrioridade) => void
  currentPriority?: TarefaPrioridade
  taskTitle?: string
}

const priorityOptions: { value: TarefaPrioridade; label: string; description: string }[] = [
  { value: 'URGENTE', label: 'Urgente', description: 'Requer atenção imediata' },
  { value: 'ALTA', label: 'Alta', description: 'Importante e deve ser priorizada' },
  { value: 'NORMAL', label: 'Normal', description: 'Prioridade padrão' },
  { value: 'BAIXA', label: 'Baixa', description: 'Pode ser feita quando houver tempo' }
]

export function PriorityModal({ 
  isOpen, 
  onClose, 
  onSave, 
  currentPriority, 
  taskTitle 
}: PriorityModalProps) {
  const [selectedPriority, setSelectedPriority] = useState<TarefaPrioridade>('NORMAL')

  useEffect(() => {
    if (isOpen && currentPriority) {
      setSelectedPriority(currentPriority)
    } else if (isOpen) {
      setSelectedPriority('NORMAL')
    }
  }, [isOpen, currentPriority])

  const handleSave = () => {
    onSave(selectedPriority)
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5" />
            Alterar Prioridade
          </DialogTitle>
          {taskTitle && (
            <p className="text-sm text-muted-foreground mt-2">
              {taskTitle}
            </p>
          )}
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Label className="text-sm font-medium">Selecione a prioridade:</Label>
          
          <div className="space-y-3">
            {priorityOptions.map((option) => (
              <div
                key={option.value}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50",
                  selectedPriority === option.value 
                    ? "border-primary bg-primary/5" 
                    : "border-border"
                )}
                onClick={() => setSelectedPriority(option.value)}
              >
                <div className="flex items-center gap-3">
                  <PriorityBadge priority={option.value} />
                  <div>
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </div>
                
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 transition-all",
                  selectedPriority === option.value
                    ? "border-primary bg-primary"
                    : "border-muted-foreground"
                )}>
                  {selectedPriority === option.value && (
                    <div className="w-full h-full rounded-full bg-white scale-50" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}