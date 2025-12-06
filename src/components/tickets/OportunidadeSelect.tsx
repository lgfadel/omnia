import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useCrmLeads } from '@/hooks/useCrmLeads';
import { CrmLeadOption } from '@/data/types';

interface OportunidadeSelectProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function OportunidadeSelect({
  value,
  onValueChange,
  placeholder = "Selecione uma oportunidade...",
  disabled = false
}: OportunidadeSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredLeads, setFilteredLeads] = useState<CrmLeadOption[]>([]);
  const { leads, loading, searchLeads } = useCrmLeads();

  // Find selected lead
  const selectedLead = leads.find(lead => lead.id === value);

  // Filter leads based on search term
  useEffect(() => {
    const filterLeads = async () => {
      if (searchTerm.trim()) {
        const results = await searchLeads(searchTerm);
        setFilteredLeads(results);
      } else {
        setFilteredLeads(leads);
      }
    };

    filterLeads();
  }, [searchTerm, leads, searchLeads]);

  const handleSelect = (leadId: string) => {
    if (value === leadId) {
      onValueChange(undefined); // Deselect if already selected
    } else {
      onValueChange(leadId);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(undefined);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'novo':
        return 'bg-blue-100 text-blue-800';
      case 'em_andamento':
        return 'bg-yellow-100 text-yellow-800';
      case 'proposta_enviada':
        return 'bg-purple-100 text-purple-800';
      case 'negociacao':
        return 'bg-orange-100 text-orange-800';
      case 'fechado_ganho':
        return 'bg-green-100 text-green-800';
      case 'fechado_perdido':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !selectedLead && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedLead ? (
              <>
                <span className="truncate">{selectedLead.cliente}</span>
                <Badge 
                  variant="secondary" 
                  className={cn("text-xs", getStatusColor(selectedLead.status))}
                >
                  {formatStatus(selectedLead.status)}
                </Badge>
              </>
            ) : (
              <span>{placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {selectedLead && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Buscar oportunidade..."
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList>
            <CommandEmpty>
              {loading ? "Carregando..." : "Nenhuma oportunidade encontrada."}
            </CommandEmpty>
            <CommandGroup>
              {filteredLeads.map((lead) => (
                <CommandItem
                  key={lead.id}
                  value={lead.id}
                  onSelect={() => handleSelect(lead.id)}
                  className="flex items-center justify-between p-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === lead.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <span className="font-medium truncate">{lead.cliente}</span>
                      <Badge 
                        variant="secondary" 
                        className={cn("text-xs w-fit", getStatusColor(lead.status))}
                      >
                        {formatStatus(lead.status)}
                      </Badge>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}