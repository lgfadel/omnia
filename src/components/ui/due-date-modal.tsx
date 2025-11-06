import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface DueDateModalProps {
  onSave: (date: Date | null) => void
  currentDate?: Date | null
  taskTitle?: string
}

export function DueDateModal({ 
  onSave, 
  currentDate 
}: DueDateModalProps) {
  const [open, setOpen] = useState(false)

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onSave(date)
    }
    setOpen(false)
  }

  // Removido: ação de remover data. A interface agora exibe apenas a data simples.

  const formatDateForDisplay = (date: Date) => {
    // Exibir apenas em formato simples dd/MM/yyyy
    return format(date, 'dd/MM/yyyy', { locale: ptBR })
  }

  const isOverdue = (() => {
    if (!currentDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const compareDate = new Date(currentDate)
    compareDate.setHours(0, 0, 0, 0)
    // Atrasado = vencido até ontem (data < hoje)
    return compareDate < today
  })()

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            className={cn(
              "inline-flex whitespace-nowrap justify-start text-left font-normal text-sm cursor-pointer select-none",
              !currentDate && "text-muted-foreground",
              currentDate && isOverdue && "text-destructive font-medium"
            )}
            aria-label="Alterar data de vencimento"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {currentDate ? formatDateForDisplay(currentDate) : "-"}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={currentDate || undefined}
            onSelect={handleDateSelect}
            initialFocus
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
      
      {/* Removido: botão de remover data. Mantemos apenas a data simples como trigger. */}
    </div>
  )
}
