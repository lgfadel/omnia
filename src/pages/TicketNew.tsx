import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { TicketForm } from "@/components/tickets/TicketForm";
import { useNavigate } from "react-router-dom";
import { useTarefasStore } from "@/store/tarefas.store";
import { useSecretariosStore } from "@/store/secretarios.store";
import { Tarefa } from "@/repositories/tarefasRepo.supabase";
import { UserRef } from "@/data/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/components/auth/AuthProvider';
import { useEffect } from "react";
import { handleSupabaseError, createErrorContext } from "@/lib/errorHandler";

export default function TicketNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { createTarefa, loading } = useTarefasStore();
  const { secretarios, loadSecretarios } = useSecretariosStore();

  useEffect(() => {
    loadSecretarios();
  }, [loadSecretarios]);

  const handleSubmit = async (ticketData: Partial<Tarefa>) => {
    try {
      const newTicket = await createTarefa({
        title: ticketData.title!,
        description: ticketData.description,
        priority: ticketData.priority!,
        dueDate: ticketData.dueDate,
        ticket: ticketData.ticket,
        statusId: ticketData.statusId!,
        assignedTo: ticketData.isPrivate ? users.find(u => u.id === user?.id) : ticketData.assignedTo,
        tags: ticketData.tags || [],
        attachments: ticketData.attachments || [],
        isPrivate: Boolean(ticketData.isPrivate)
      });

      toast({
        title: "Tarefa criada com sucesso!",
        description: `A tarefa "${newTicket.title}" foi criada e está disponível na lista.`,
      });

      navigate('/tarefas');
    } catch (error) {
      console.error('Erro ao criar tarefa:', error);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('create', 'tarefa', 'omnia_tarefas')
      );
      toast({
        title: "Erro ao criar tarefa",
        description: treatedError.message,
        variant: "destructive"
      });
    }
  };

  const handleCancel = () => {
    navigate('/tarefas');
  };

  const users: UserRef[] = secretarios.map(secretario => ({
    id: secretario.id,
    name: secretario.name,
    email: secretario.email,
    roles: secretario.roles,
    avatarUrl: secretario.avatarUrl,
    color: secretario.color,
  }));

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Tarefas", href: "/tarefas" },
            { label: "Nova Tarefa", isActive: true }
          ]} 
        />
        
        <div className="max-w-4xl mx-auto">
          <TicketForm
            users={users}
            onSubmit={handleSubmit}
            loading={loading}
          />
        </div>
      </div>
    </Layout>
  );
}