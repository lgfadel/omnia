import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, X } from 'lucide-react'
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

  const handleRemoveDate = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSave(null)
  }

  const formatDateForDisplay = (date: Date) => {
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
              !currentDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {currentDate ? formatDateForDisplay(currentDate) : "Definir data de vencimento"}
          </Button>
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
      
      {currentDate && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-gray-100"
          onClick={handleRemoveDate}
          title="Remover data de vencimento"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}