import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TagInput } from '@/components/atas/TagInput';
import { FileUploader } from '@/components/atas/FileUploader';
import { AttachmentsList } from '@/components/atas/AttachmentsList';
import { TicketStatusSelect } from './TicketStatusSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tarefa, TarefaPrioridade } from '@/repositories/tarefasRepo.supabase';
import { TarefaStatus } from '@/repositories/tarefaStatusRepo.supabase';
import { UserRef, Attachment } from '@/data/fixtures';
import { useTarefaStatusStore } from '@/store/tarefaStatus.store';
import { useAuth } from '@/contexts/AuthContext';

const ticketSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  priority: z.enum(['ALTA', 'NORMAL', 'BAIXA']),
  dueDate: z.string().optional(),
  ticket: z.string().optional(),
  statusId: z.string().min(1, 'Status é obrigatório'),
  assignedTo: z.string().optional(),
});

type TicketFormData = z.infer<typeof ticketSchema>;

interface TicketFormProps {
  ticket?: Tarefa;
  users: UserRef[];
  onSubmit: (data: Partial<Tarefa>) => Promise<void>;
  loading?: boolean;
}

export function TicketForm({ ticket, users, onSubmit, loading }: TicketFormProps) {
  const [tags, setTags] = useState<string[]>(ticket?.tags || []);
  const [attachments, setAttachments] = useState<Attachment[]>(ticket?.attachments || []);
  const { statuses, loadStatuses } = useTarefaStatusStore();
  const { userProfile } = useAuth();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: ticket?.title || '',
      description: ticket?.description || '',
      priority: ticket?.priority || 'NORMAL',
      dueDate: ticket?.dueDate ? ticket.dueDate.toISOString().split('T')[0] : '',
      ticket: ticket?.ticket || '',
      statusId: ticket?.statusId || '',
      assignedTo: ticket?.assignedTo?.id || '',
    },
  });

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  // Set default status for new tickets
  useEffect(() => {
    if (!ticket && statuses.length > 0) {
      const defaultStatus = statuses.find(s => s.isDefault) || statuses[0];
      setValue('statusId', defaultStatus.id);
    }
  }, [statuses, ticket, setValue]);

  const handleFormSubmit = async (data: TicketFormData) => {
    const ticketData: Partial<Tarefa> = {
      title: data.title,
      description: data.description || undefined,
      priority: data.priority as TarefaPrioridade,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      ticket: data.ticket || undefined,
      statusId: data.statusId,
      assignedTo: data.assignedTo ? users.find(u => u.id === data.assignedTo) : undefined,
      tags,
      attachments,
    };

    await onSubmit(ticketData);
  };

  const handleUpload = (attachment: Attachment) => {
    setAttachments(prev => [...prev, attachment]);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="Digite o título do ticket"
            />
            {errors.title && (
              <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descreva o ticket..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Prioridade</Label>
              <Select
                value={watch('priority')}
                onValueChange={(value) => setValue('priority', value as TarefaPrioridade)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dueDate">Data de Vencimento</Label>
              <Input
                id="dueDate"
                type="date"
                {...register('dueDate')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ticket">Ticket</Label>
              <Input
                id="ticket"
                {...register('ticket')}
                placeholder="Ex: TCK-12345"
              />
            </div>

            <div>
              <Label htmlFor="assignedTo">Responsável</Label>
              <Select
                value={watch('assignedTo') || undefined}
                onValueChange={(value) => setValue('assignedTo', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um responsável" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <TicketStatusSelect
              statuses={statuses}
              value={watch('statusId')}
              onValueChange={(value) => setValue('statusId', value)}
            />
            {errors.statusId && (
              <p className="text-sm text-destructive mt-1">{errors.statusId.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <TagInput
            tags={tags}
            onTagsChange={setTags}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anexos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUploader onUpload={handleUpload} />
          {attachments.length > 0 && (
            <AttachmentsList
              attachments={attachments}
              onDelete={handleRemoveAttachment}
              canDelete={true}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : ticket ? 'Atualizar Ticket' : 'Criar Ticket'}
        </Button>
      </div>
    </form>
  );
}