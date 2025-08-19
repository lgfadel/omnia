import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { TicketForm } from '@/components/tickets/TicketForm';
import { useTarefasStore } from '@/store/tarefas.store';
import { useSecretariosStore } from '@/store/secretarios.store';
import { Tarefa } from '@/repositories/tarefasRepo.supabase';
import { UserRef } from '@/data/fixtures';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TicketEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Tarefa | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const { getTarefaById, updateTarefa } = useTarefasStore();
  const { secretarios, loadSecretarios } = useSecretariosStore();

  useEffect(() => {
    loadSecretarios();
  }, [loadSecretarios]);

  useEffect(() => {
    const loadTicket = async () => {
      if (!id) return;
      
      setInitialLoading(true);
      try {
        const ticket = await getTarefaById(id);
        setTicket(ticket);
      } catch (error) {
        console.error('Erro ao carregar ticket:', error);
        toast({
          title: 'Erro ao carregar ticket',
          description: 'Não foi possível carregar os dados do ticket.',
          variant: 'destructive',
        });
        navigate('/tickets');
      } finally {
        setInitialLoading(false);
      }
    };

    loadTicket();
  }, [id, getTarefaById, navigate]);

  const handleSubmit = async (ticketData: Partial<Tarefa>) => {
    if (!ticket) return;
    
    setLoading(true);
    try {
      const updatedTicket = await updateTarefa(ticket.id, {
        title: ticketData.title,
        description: ticketData.description,
        priority: ticketData.priority,
        dueDate: ticketData.dueDate,
        ticket: ticketData.ticket,
        statusId: ticketData.statusId,
        assignedTo: ticketData.assignedTo,
        tags: ticketData.tags,
        attachments: ticketData.attachments,
      });

      if (updatedTicket) {
        toast({
          title: 'Ticket atualizado com sucesso!',
          description: `O ticket "${updatedTicket.title}" foi atualizado.`,
        });

        navigate(`/tickets/${ticket.id}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar ticket:', error);
      toast({
        title: 'Erro ao atualizar ticket',
        description: 'Ocorreu um erro ao atualizar o ticket. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const users: UserRef[] = secretarios.map(secretario => ({
    id: secretario.id,
    name: secretario.name,
    email: secretario.email,
    roles: secretario.roles,
    avatarUrl: secretario.avatarUrl,
    color: secretario.color,
  }));

  if (initialLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center">Carregando ticket...</div>
        </div>
      </Layout>
    );
  }

  if (!ticket) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Ticket não encontrado</p>
            <Button onClick={() => navigate('/tickets')}>
              Voltar para Tickets
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/tickets/${ticket.id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary">Editar Ticket</h1>
            <p className="text-muted-foreground">
              Edite as informações do ticket "{ticket.title}"
            </p>
          </div>
        </div>

        <TicketForm
          ticket={ticket}
          users={users}
          onSubmit={handleSubmit}
          loading={loading}
        />
      </div>
    </Layout>
  );
}