"use client";

import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { TicketForm } from "@/components/tickets/TicketForm";
import { useTarefasStore } from "@/stores/tarefas.store";
import { useSecretariosStore } from "@/stores/secretarios.store";
import { ticketAttachmentsRepoSupabase } from "@/repositories/ticketAttachmentsRepo.supabase";
import { Tarefa } from "@/repositories/tarefasRepo.supabase";
import { UserRef } from "@/data/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/components/auth/AuthProvider';
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { handleSupabaseError, createErrorContext } from "@/lib/errorHandler";
import { logger } from '@/lib/logging';

export default function TicketEdit() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
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
        logger.error('Erro ao carregar tarefa:', error);
        toast({
          title: 'Erro ao carregar tarefa',
          description: 'Não foi possível carregar os dados da tarefa.',
          variant: 'destructive',
        });
        router.push('/tarefas');
      } finally {
        setInitialLoading(false);
      }
    };

    loadTicket();
  }, [id, getTarefaById, router, toast]);

  const users: UserRef[] = secretarios.map(secretario => ({
    id: secretario.id,
    name: secretario.name,
    email: secretario.email,
    roles: secretario.roles,
    avatarUrl: secretario.avatarUrl,
    color: secretario.color,
  }));

  const handleSubmit = async (ticketData: Partial<Tarefa>) => {
    if (!ticket) return;
    
    setLoading(true);
    try {
      const updatedTicket = await updateTarefa(ticket.id, {
        title: ticketData.title,
        description: ticketData.description,
        priority: ticketData.priority,
        dueDate: ticketData.dueDate,
        ticketOcta: ticketData.ticketOcta,
        statusId: ticketData.statusId,
        assignedTo: ticketData.isPrivate ? users.find(u => u.id === user?.id) : ticketData.assignedTo,
        tags: ticketData.tags,
        attachments: ticketData.attachments,
        isPrivate: ticketData.isPrivate,
        oportunidadeId: ticketData.oportunidadeId,
      });

      // Salvar novos anexos (aqueles que não têm id no banco ainda)
      if (ticketData.attachments && ticketData.attachments.length > 0) {
        const existingAttachments = ticket.attachments || [];
        const existingIds = new Set(existingAttachments.map(a => a.id));
        
        for (const attachment of ticketData.attachments) {
          // Só criar anexos novos (que não existem no banco)
          if (!existingIds.has(attachment.id)) {
            try {
              await ticketAttachmentsRepoSupabase.create({
                ticket_id: ticket.id,
                name: attachment.name,
                url: attachment.url,
                mime_type: attachment.mime || null,
                size_kb: attachment.sizeKB || null,
                uploaded_by: user?.id || null,
              });
            } catch (attachmentError) {
              logger.error('Erro ao salvar anexo:', attachmentError);
            }
          }
        }
      }

      if (updatedTicket) {
        toast({
          title: 'Tarefa atualizada com sucesso!',
          description: `A tarefa "${updatedTicket.title}" foi atualizada.`,
        });

        router.push(`/tarefas/${ticket.id}`);
      }
    } catch (error) {
      logger.error('Erro ao atualizar tarefa:', error);
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
            <Button onClick={() => router.push('/tarefas')}>
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
