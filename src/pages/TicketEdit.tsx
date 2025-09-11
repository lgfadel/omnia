import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { TicketForm } from "@/components/tickets/TicketForm";
import { useTarefasStore } from "@/store/tarefas.store";
import { useSecretariosStore } from "@/store/secretarios.store";
import { Tarefa } from "@/repositories/tarefasRepo.supabase";
import { UserRef } from "@/data/fixtures";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { handleSupabaseError, createErrorContext } from "@/lib/errorHandler";

export default function TicketEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
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
        console.error('Erro ao carregar tarefa:', error);
        toast({
          title: 'Erro ao carregar tarefa',
          description: 'Não foi possível carregar os dados da tarefa.',
          variant: 'destructive',
        });
        navigate('/tarefas');
      } finally {
        setInitialLoading(false);
      }
    };

    loadTicket();
  }, [id, getTarefaById, navigate, toast]);

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
        assignedTo: ticketData.isPrivate ? users.find(u => u.id === user?.id) : ticketData.assignedTo,
        tags: ticketData.tags,
        attachments: ticketData.attachments,
        isPrivate: ticketData.isPrivate,
      });

      if (updatedTicket) {
        toast({
          title: 'Tarefa atualizada com sucesso!',
          description: `A tarefa "${updatedTicket.title}" foi atualizada.`,
        });

        navigate(`/tarefas/${ticket.id}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('update', 'tarefa', 'omnia_tarefas')
      );
      toast({
        title: 'Erro ao atualizar tarefa',
        description: treatedError.message,
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
          <div className="text-center">Carregando tarefa...</div>
        </div>
      </Layout>
    );
  }

  if (!ticket) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Tarefa não encontrada</p>
            <Button onClick={() => navigate('/tarefas')}>
              Voltar para Tarefas
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Tarefas", href: "/tarefas" },
            { label: ticket.title, href: `/tarefas/${ticket.id}` },
            { label: "Editar", isActive: true }
          ]} 
        />
        
        <div className="max-w-4xl mx-auto">
          <TicketForm
            ticket={ticket}
            users={users}
            onSubmit={handleSubmit}
            loading={loading}
          />
        </div>
      </div>
    </Layout>
  );
}