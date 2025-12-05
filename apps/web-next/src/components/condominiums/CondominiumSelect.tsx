import { useState, useMemo } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Condominium } from "@/repositories/condominiumsRepo.supabase";

interface CondominiumSelectProps {
  condominiums: Condominium[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Helper to make search accent-insensitive and case-insensitive
function normalize(text: string) {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function CondominiumSelect({
  condominiums,
  value,
  onValueChange,
  placeholder = "Selecione o condomínio...",
  className,
  disabled = false,
}: CondominiumSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedCondominium = useMemo(
    () => condominiums.find((c) => c.id === value),
    [condominiums, value]
  );

  const filteredCondominiums = useMemo(() => {
    if (!searchTerm.trim()) return condominiums;
    const query = normalize(searchTerm);
    return condominiums.filter((c) => normalize(c.name).includes(query));
  }, [condominiums, searchTerm]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between",
            !selectedCondominium && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {selectedCondominium ? selectedCondominium.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar condomínio..."
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
          <CommandList>
            <CommandEmpty>Nenhum condomínio encontrado.</CommandEmpty>
            <CommandGroup>
              {filteredCondominiums.map((condominium) => (
                <CommandItem
                  key={condominium.id}
                  value={condominium.name}
                  onSelect={() => {
                    onValueChange(condominium.id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === condominium.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{condominium.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

