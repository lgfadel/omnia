'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TagInput } from '@/components/atas/TagInput';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AdmissaoStatusSelect } from './AdmissaoStatusSelect';
import { useAdmissoesStore } from '@/store/admissoes.store';
import { useAdmissaoStatusStore } from '@/store/admissaoStatus.store';
import { useSecretariosStore } from '@/store/secretarios.store';
import { useToast } from '@/hooks/use-toast';
import type { Admissao, AdmissaoPrioridade } from '@/repositories/admissoesRepo.supabase';

const PRIORITIES: { value: AdmissaoPrioridade; label: string; color: string }[] = [
  { value: 'URGENTE', label: 'Urgente', color: 'bg-red-500' },
  { value: 'ALTA', label: 'Alta', color: 'bg-orange-500' },
  { value: 'NORMAL', label: 'Normal', color: 'bg-blue-500' },
  { value: 'BAIXA', label: 'Baixa', color: 'bg-gray-500' },
];

interface AdmissaoFormProps {
  admissao?: Admissao | null;
  mode: 'create' | 'edit';
}

export function AdmissaoForm({ admissao, mode }: AdmissaoFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { createAdmissao, updateAdmissao, loading } = useAdmissoesStore();
  const { statuses, loadStatuses } = useAdmissaoStatusStore();
  const { secretarios, loadSecretarios } = useSecretariosStore();

  const [title, setTitle] = useState(admissao?.title || '');
  const [description, setDescription] = useState(admissao?.description || '');
  const [priority, setPriority] = useState<AdmissaoPrioridade>(admissao?.priority || 'NORMAL');
  const [dueDate, setDueDate] = useState<Date | undefined>(admissao?.dueDate);
  const [ticketOcta, setTicketOcta] = useState(admissao?.ticketOcta || '');
  const [statusId, setStatusId] = useState(admissao?.statusId || '');
  const [assignedToId, setAssignedToId] = useState(admissao?.assignedTo?.id || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(admissao?.tags || []);

  useEffect(() => {
    if (statuses.length === 0) loadStatuses();
    if (secretarios.length === 0) loadSecretarios();
  }, [statuses.length, secretarios.length, loadStatuses, loadSecretarios]);

  useEffect(() => {
    if (!statusId && statuses.length > 0) {
      const defaultStatus = statuses.find(s => s.isDefault);
      if (defaultStatus) setStatusId(defaultStatus.id);
    }
  }, [statuses, statusId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({ title: 'Erro', description: 'O título é obrigatório', variant: 'destructive' });
      return;
    }

    if (!statusId) {
      toast({ title: 'Erro', description: 'Selecione um status', variant: 'destructive' });
      return;
    }

    try {
      const assignedTo = assignedToId 
        ? secretarios.find(s => s.id === assignedToId) 
        : undefined;

      const admissaoData = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate,
        ticketOcta: ticketOcta.trim() || undefined,
        statusId,
        assignedTo: assignedTo ? {
          id: assignedTo.id,
          name: assignedTo.name,
          email: assignedTo.email,
          roles: assignedTo.roles || [],
          avatarUrl: assignedTo.avatarUrl,
          color: assignedTo.color,
        } : undefined,
        tags: selectedTags,
        isPrivate: admissao?.isPrivate || false,
      };

      if (mode === 'create') {
        await createAdmissao(admissaoData);
        toast({ title: 'Sucesso', description: 'Admissão criada com sucesso!' });
      } else if (admissao) {
        await updateAdmissao(admissao.id, admissaoData);
        toast({ title: 'Sucesso', description: 'Admissão atualizada com sucesso!' });
      }

      router.push('/admissoes');
    } catch (error) {
      toast({ 
        title: 'Erro', 
        description: error instanceof Error ? error.message : 'Ocorreu um erro',
        variant: 'destructive' 
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Nova Admissão' : 'Editar Admissão'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nome do funcionário ou descrição da admissão"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes adicionais sobre a admissão..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Status *</Label>
              <AdmissaoStatusSelect
                value={statusId}
                onChange={setStatusId}
              />
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as AdmissaoPrioridade)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-3 h-3 rounded-full', p.color)} />
                        <span>{p.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={assignedToId || '_none'} onValueChange={(v) => setAssignedToId(v === '_none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum</SelectItem>
                  {secretarios.map((secretario) => (
                    <SelectItem key={secretario.id} value={secretario.id}>
                      {secretario.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione uma data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticketOcta">Ticket (Octa)</Label>
              <Input
                id="ticketOcta"
                value={ticketOcta}
                onChange={(e) => setTicketOcta(e.target.value)}
                placeholder="Número do ticket"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Tags</Label>
              <TagInput
                tags={selectedTags}
                onTagsChange={setSelectedTags}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Criar Admissão' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
