import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { listTaskAssignees } from '@/repositories/tarefasRepo.supabase'
import type { UserRef } from '@/data/types'

interface TicketAssigneeSelectProps {
  users: UserRef[]
  selected?: UserRef
  onChange: (user: UserRef) => void
  disabled?: boolean
}

export function TicketAssigneeSelect({users,selected,onChange,disabled}:TicketAssigneeSelectProps) {
  const [open,setOpen]=useState(false)
  const [query,setQuery]=useState('')
  const [matches,setMatches]=useState<UserRef[]>([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState(false)
  useEffect(()=>{
    const term=query.trim()
    if (!open || !term) return
    let cancelled=false
    const timer=setTimeout(()=>{
      void listTaskAssignees(term).then(found=>{
        if (!cancelled) {setMatches(found);setLoading(false)}
      }).catch(()=>{
        if (!cancelled) {setMatches([]);setLoading(false);setError(true)}
      })
    },250)
    return ()=>{cancelled=true;clearTimeout(timer)}
  },[open,query])
  const choices=query.trim() ? matches : users
  const changeQuery=(value:string)=>{
    setQuery(value);setMatches([]);setError(false);setLoading(Boolean(value.trim()))
  }
  const changeOpen=(next:boolean)=>{
    setOpen(next)
    if (!next) {setQuery('');setMatches([]);setLoading(false);setError(false)}
  }
  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverTrigger asChild><Button id="assignedTo" type="button" variant="outline" role="combobox" aria-expanded={open} aria-label="Responsável" disabled={disabled} className="w-full justify-between font-normal">
      <span className="truncate">{selected?.name || 'Selecione um responsável'}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button></PopoverTrigger>
    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
      <Command shouldFilter={false}>
        <CommandInput placeholder="Buscar responsável..." value={query} onValueChange={changeQuery} />
        <CommandList>
          {loading ? <p className="py-3 text-center text-sm text-muted-foreground">Buscando...</p> : error ? <p role="alert" className="py-3 text-center text-sm text-destructive">Não foi possível buscar responsáveis.</p> : <CommandEmpty>Nenhum responsável encontrado.</CommandEmpty>}
          <CommandGroup>{choices.map(user=><CommandItem key={user.id} value={user.id} onSelect={()=>{onChange(user);changeOpen(false)}}>
            <Check className={`mr-2 h-4 w-4 ${selected?.id===user.id?'opacity-100':'opacity-0'}`} />{user.name}
          </CommandItem>)}</CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
}
