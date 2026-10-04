import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { TagInput } from '@/components/atas/TagInput';
import { FileUploader } from '@/components/atas/FileUploader';
import { AttachmentsList } from '@/components/atas/AttachmentsList';
import { TicketStatusSelect } from './TicketStatusSelect';
import { TicketAssigneeSelect } from './TicketAssigneeSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tarefa, TarefaPrioridade, taskDateValue, localTaskDate } from '@/repositories/tarefasRepo.supabase';
import { TarefaStatus } from '@/repositories/tarefaStatusRepo.supabase';
import { UserRef, Attachment } from '@/data/types';
import { useTarefaStatusStore } from '@/stores/tarefaStatus.store';
import { useAuth } from '@/components/auth/AuthProvider';

const ticketSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  priority: z.enum(['URGENTE', 'ALTA', 'NORMAL', 'BAIXA']),
  dueDate: z.string().optional(),
  ticketOcta: z.string().optional(),
  statusId: z.string().min(1, 'Status é obrigatório'),
  assignedTo: z.string().optional(),
  oportunidadeId: z.string().optional(),
  isPrivate: z.boolean().default(false),
  recurrenceEnabled: z.boolean().default(false),
  recurrenceFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).default('WEEKLY'),
  recurrenceInterval: z.coerce.number().min(1, 'Intervalo deve ser maior que zero').default(1),
  recurrenceStartDate: z.string().optional(),
  recurrenceEndType: z.enum(['NEVER', 'ON_DATE', 'AFTER_COUNT']).default('NEVER'),
  recurrenceEndDate: z.string().optional(),
  recurrenceOccurrenceLimit: z.preprocess(
    value => value === '' || value === undefined ? undefined : Number(value),
    z.number().min(1, 'Quantidade deve ser maior que zero').optional(),
  ),
}).superRefine((data, ctx) => {
  if (!data.recurrenceEnabled) return

  if (!data.recurrenceStartDate && !data.dueDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['recurrenceStartDate'],
      message: 'Informe a data inicial ou a data de vencimento',
    })
  }

  if (data.recurrenceEndType === 'ON_DATE' && !data.recurrenceEndDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['recurrenceEndDate'],
      message: 'Data final é obrigatória',
    })
  }

  if (data.recurrenceEndType === 'AFTER_COUNT' && !data.recurrenceOccurrenceLimit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['recurrenceOccurrenceLimit'],
      message: 'Quantidade é obrigatória',
    })
  }
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
  const [selectedAssignee, setSelectedAssignee] = useState<UserRef | undefined>(ticket?.assignedTo);
  const { statuses, loadStatuses } = useTarefaStatusStore();
  const { userProfile } = useAuth();



  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TicketFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(ticketSchema as any),
    defaultValues: {
      title: ticket?.title || '',
      description: ticket?.description || '',
      priority: ticket?.priority || 'NORMAL',
      dueDate: ticket?.dueDate ? taskDateValue(ticket.dueDate)! : '',
      ticketOcta: ticket?.ticketOcta || '',
      statusId: ticket?.statusId || '',
      assignedTo: ticket?.assignedTo?.id || '',
      oportunidadeId: ticket?.oportunidadeId || '',
      isPrivate: ticket?.isPrivate || false,
      recurrenceEnabled: ticket?.recurrence?.enabled || false,
      recurrenceFrequency: ticket?.recurrence?.frequency || 'WEEKLY',
      recurrenceInterval: ticket?.recurrence?.interval || 1,
      recurrenceStartDate: ticket?.recurrence?.startDate
        ? taskDateValue(ticket.recurrence.startDate)!
        : (ticket?.dueDate ? taskDateValue(ticket.dueDate)! : ''),
      recurrenceEndType: ticket?.recurrence?.endType || 'NEVER',
      recurrenceEndDate: ticket?.recurrence?.endDate ? taskDateValue(ticket.recurrence.endDate)! : '',
      recurrenceOccurrenceLimit: ticket?.recurrence?.occurrenceLimit,
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

  // Set logged user as default assignee for new tickets
  useEffect(() => {
    if (!ticket && userProfile?.id) {
      setSelectedAssignee(userProfile);
      setValue('assignedTo', userProfile.id);
    }
  }, [userProfile, ticket, setValue]);

  // Force re-render when assignedTo changes
  const assignedToValue = watch('assignedTo');
  const recurrenceEnabled = watch('recurrenceEnabled');
  const recurrenceEndType = watch('recurrenceEndType');

  const handleFormSubmit = async (data: TicketFormData) => {
    const ticketData: Partial<Tarefa> = {
      title: data.title,
      description: data.description || undefined,
      priority: data.priority as TarefaPrioridade,
      dueDate: data.dueDate ? localTaskDate(data.dueDate) : undefined,
      ticketOcta: data.ticketOcta || undefined,
      statusId: data.statusId,
      assignedTo: data.assignedTo ? (selectedAssignee?.id === data.assignedTo ? selectedAssignee : users.find(u => u.id === data.assignedTo)) : undefined,
      oportunidadeId: data.oportunidadeId || undefined,
      tags,
      attachments,
      isPrivate: Boolean(data.isPrivate),
      recurrence: data.recurrenceEnabled ? {
        id: ticket?.recurrence?.id,
        enabled: true,
        frequency: data.recurrenceFrequency,
        interval: data.recurrenceInterval,
        startDate: localTaskDate(data.recurrenceStartDate || data.dueDate!)!,
        endType: data.recurrenceEndType,
        endDate: data.recurrenceEndDate ? localTaskDate(data.recurrenceEndDate) : undefined,
        occurrenceLimit: data.recurrenceOccurrenceLimit,
      } : (ticket?.recurrence ? { ...ticket.recurrence, enabled: false } : undefined),
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
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>{ticket ? 'Editar Tarefa' : 'Nova Tarefa'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Informações Básicas</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  {...register('title')}
                  placeholder="Digite o título da tarefa"
                />
                {errors.title && (
                  <p className="text-sm text-destructive">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Data de Vencimento</Label>
                <Input
                  id="dueDate"
                  type="date"
                  {...register('dueDate')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Descreva a tarefa..."
                rows={4}
              />
            </div>
          </div>

          <Separator />

          {/* Classificação */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Classificação</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Select
                  value={watch('priority')}
                  onValueChange={(value) => setValue('priority', value as TarefaPrioridade)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="URGENTE">Urgente</SelectItem>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="BAIXA">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticketOcta">Ticket</Label>
                <Input
                  id="ticketOcta"
                  {...register('ticketOcta')}
                  placeholder="Ex: TCK-12345"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Responsabilidades */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Responsabilidades</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Responsável</Label>
                <TicketAssigneeSelect
                  users={users}
                  selected={selectedAssignee?.id === assignedToValue ? selectedAssignee : ticket?.assignedTo?.id === assignedToValue ? ticket?.assignedTo : users.find(user => user.id === assignedToValue)}
                  onChange={(user) => { setSelectedAssignee(user); setValue('assignedTo', user.id); }}
                  disabled={watch('isPrivate')}
                />
                {watch('isPrivate') && (
                  <p className="text-xs text-muted-foreground">Tarefas privadas são automaticamente atribuídas ao criador</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Status *</Label>
                <TicketStatusSelect
                  statuses={statuses}
                  value={watch('statusId')}
                  onValueChange={(value) => setValue('statusId', value)}
                />
                {errors.statusId && (
                  <p className="text-sm text-destructive">{errors.statusId.message}</p>
                )}
              </div>
            </div>

            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPrivate"
                checked={watch('isPrivate')}
                onCheckedChange={(checked) => {
                  setValue('isPrivate', checked as boolean);
                  // Se marcar como privada, define o usuário corrente como responsável
                  if (checked && userProfile) {
                    setValue('assignedTo', userProfile.id);
                    setSelectedAssignee(userProfile);
                  }
                }}
              />
              <Label htmlFor="isPrivate" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Tarefa Privada
              </Label>
            </div>
            
          </div>

          <Separator />

          {/* Recorrência */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium">Recorrência</h3>
                <p className="text-sm text-muted-foreground">
                  Gere novas ocorrências desta tarefa em uma cadência definida.
                </p>
              </div>
              <Switch
                checked={recurrenceEnabled}
                onCheckedChange={(checked) => setValue('recurrenceEnabled', checked)}
              />
            </div>

            {recurrenceEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border p-4">
                <div className="space-y-2">
                  <Label htmlFor="recurrenceFrequency">Frequência</Label>
                  <Select
                    value={watch('recurrenceFrequency')}
                    onValueChange={(value) => setValue('recurrenceFrequency', value as TicketFormData['recurrenceFrequency'])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a frequência" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Diária</SelectItem>
                      <SelectItem value="WEEKLY">Semanal</SelectItem>
                      <SelectItem value="MONTHLY">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recurrenceInterval">Intervalo</Label>
                  <Input
                    id="recurrenceInterval"
                    type="number"
                    min={1}
                    {...register('recurrenceInterval')}
                  />
                  {errors.recurrenceInterval && (
                    <p className="text-sm text-destructive">{errors.recurrenceInterval.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recurrenceStartDate">Data inicial</Label>
                  <Input
                    id="recurrenceStartDate"
                    type="date"
                    {...register('recurrenceStartDate')}
                  />
                  {errors.recurrenceStartDate && (
                    <p className="text-sm text-destructive">{errors.recurrenceStartDate.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recurrenceEndType">Término</Label>
                  <Select
                    value={recurrenceEndType}
                    onValueChange={(value) => setValue('recurrenceEndType', value as TicketFormData['recurrenceEndType'])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o término" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEVER">Nunca</SelectItem>
                      <SelectItem value="ON_DATE">Em uma data</SelectItem>
                      <SelectItem value="AFTER_COUNT">Após X ocorrências</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {recurrenceEndType === 'ON_DATE' && (
                  <div className="space-y-2">
                    <Label htmlFor="recurrenceEndDate">Data final</Label>
                    <Input
                      id="recurrenceEndDate"
                      type="date"
                      {...register('recurrenceEndDate')}
                    />
                    {errors.recurrenceEndDate && (
                      <p className="text-sm text-destructive">{errors.recurrenceEndDate.message}</p>
                    )}
                  </div>
                )}

                {recurrenceEndType === 'AFTER_COUNT' && (
                  <div className="space-y-2">
                    <Label htmlFor="recurrenceOccurrenceLimit">Quantidade de ocorrências</Label>
                    <Input
                      id="recurrenceOccurrenceLimit"
                      type="number"
                      min={1}
                      {...register('recurrenceOccurrenceLimit')}
                    />
                    {errors.recurrenceOccurrenceLimit && (
                      <p className="text-sm text-destructive">{errors.recurrenceOccurrenceLimit.message}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Tags */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Tags</h3>
            <TagInput
              tags={tags}
              onTagsChange={setTags}
            />
          </div>

          <Separator />

          {/* Anexos */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Anexos</h3>
            <FileUploader onUpload={handleUpload} />
            {attachments.length > 0 && (
              <AttachmentsList
                attachments={attachments}
                onDelete={handleRemoveAttachment}
                canDelete={true}
              />
            )}
          </div>

          <Separator />

          {/* Ações */}
          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : ticket ? "Atualizar Tarefa" : "Criar Tarefa"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
