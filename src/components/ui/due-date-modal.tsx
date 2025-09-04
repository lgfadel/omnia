import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface DueDateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (date: Date | null) => void
  currentDate?: Date | null
  taskTitle?: string
}

export function DueDateModal({ 
  isOpen, 
  onClose, 
  onSave, 
  currentDate, 
  taskTitle 
}: DueDateModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [hasDate, setHasDate] = useState(false)

  // Hook para fechar modal com ESC
  useEscapeKey(onClose, isOpen)

  useEffect(() => {
    if (isOpen) {
      if (currentDate) {
        setSelectedDate(format(currentDate, 'yyyy-MM-dd'))
        setHasDate(true)
      } else {
        setSelectedDate('')
        setHasDate(false)
      }
    }
  }, [isOpen, currentDate])

  const handleSave = () => {
    if (hasDate && selectedDate) {
      const date = new Date(selectedDate + 'T00:00:00')
      onSave(date)
    } else {
      onSave(null)
    }
    onClose()
  }

  const handleRemoveDate = () => {
    setSelectedDate('')
    setHasDate(false)
  }

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString + 'T00:00:00')
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Alterar Data de Vencimento
          </DialogTitle>
          {taskTitle && (
            <p className="text-sm text-muted-foreground mt-2">
              {taskTitle}
            </p>
          )}
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="hasDate"
              checked={hasDate}
              onChange={(e) => {
                setHasDate(e.target.checked)
                if (!e.target.checked) {
                  setSelectedDate('')
                }
              }}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="hasDate" className="text-sm font-medium">
              Definir data de vencimento
            </Label>
          </div>

          {hasDate && (
            <div className="space-y-2">
              <Label htmlFor="dueDate" className="text-sm font-medium">
                Data de Vencimento
              </Label>
              <div className="relative">
                <Input
                  id="dueDate"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pr-10"
                />
                {selectedDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100"
                    onClick={handleRemoveDate}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {selectedDate && (
                <p className="text-xs text-muted-foreground">
                  {formatDateForDisplay(selectedDate)}
                </p>
              )}
            </div>
          )}

          {!hasDate && (
            <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-md">
              A tarefa não terá data de vencimento definida.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
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