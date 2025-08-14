import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Status } from "@/data/fixtures"
import { useState } from "react"

interface StatusSelectProps {
  statuses: Status[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function StatusSelect({ 
  statuses, 
  value, 
  onValueChange, 
  placeholder = "Selecione um status...",
  className 
}: StatusSelectProps) {
  const [open, setOpen] = useState(false)
  
  const selectedStatus = statuses.find(status => status.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          {selectedStatus ? (
            <Badge 
              variant="secondary" 
              style={{ backgroundColor: selectedStatus.color + '20', color: selectedStatus.color }}
              className="border-0"
            >
              {selectedStatus.name}
            </Badge>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Buscar status..." />
          <CommandList>
            <CommandEmpty>Nenhum status encontrado.</CommandEmpty>
            <CommandGroup>
              {statuses.map((status) => (
                <CommandItem
                  key={status.id}
                  value={status.id}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue === value ? "" : currentValue)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === status.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Badge 
                    variant="secondary" 
                    style={{ backgroundColor: status.color + '20', color: status.color }}
                    className="border-0"
                  >
                    {status.name}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}