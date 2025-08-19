import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { TicketStatus } from "@/repositories/ticketStatusRepo.supabase";

interface TicketStatusSelectProps {
  statuses: TicketStatus[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function TicketStatusSelect({
  statuses,
  value,
  onValueChange,
  placeholder = "Selecione um status...",
  className,
}: TicketStatusSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedStatus = statuses.find(status => status.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedStatus ? (
            <div className="flex items-center gap-2">
              <Badge 
                className="text-white font-medium"
                style={{ backgroundColor: selectedStatus.color }}
              >
                {selectedStatus.name}
              </Badge>
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Buscar status..." />
          <CommandList>
            <CommandEmpty>Nenhum status encontrado.</CommandEmpty>
            <CommandGroup>
              {statuses.map((status) => (
                <CommandItem
                  key={status.id}
                  value={status.name}
                  onSelect={() => {
                    onValueChange(status.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === status.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Badge 
                    className="text-white font-medium"
                    style={{ backgroundColor: status.color }}
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
  );
}