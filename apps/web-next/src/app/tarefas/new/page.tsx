"use client";

import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { TicketForm } from "@/components/tickets/TicketForm";
import { useRouter } from "next/navigation";
import { useTarefasStore } from "@/store/tarefas.store";
import { useSecretariosStore } from "@/store/secretarios.store";
import { ticketAttachmentsRepoSupabase } from "@/repositories/ticketAttachmentsRepo.supabase";
import { Tarefa } from "@/repositories/tarefasRepo.supabase";
import { UserRef } from "@/data/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/components/auth/AuthProvider';
import { useEffect } from "react";
import { handleSupabaseError, createErrorContext } from "@/lib/errorHandler";
import { logger } from '@/lib/logging';

export default function TicketNew() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const { createTarefa, loading } = useTarefasStore();
  const { secretarios, loadSecretarios } = useSecretariosStore();

  useEffect(() => {
    loadSecretarios();
  }, [loadSecretarios]);

  const users: UserRef[] = secretarios.map(secretario => ({
    id: secretario.id,
    name: secretario.name,
    email: secretario.email,
    roles: secretario.roles,
    avatarUrl: secretario.avatarUrl,
    color: secretario.color,
  }));

  const handleSubmit = async (ticketData: Partial<Tarefa>) => {
    try {
      const newTicket = await createTarefa({
        title: ticketData.title!,
        description: ticketData.description,
        priority: ticketData.priority!,
        dueDate: ticketData.dueDate,
        ticketOcta: ticketData.ticketOcta,
        statusId: ticketData.statusId!,
        assignedTo: ticketData.isPrivate ? users.find(u => u.id === user?.id) : ticketData.assignedTo,
        tags: ticketData.tags || [],
        attachments: ticketData.attachments || [],
        isPrivate: Boolean(ticketData.isPrivate),
        oportunidadeId: ticketData.oportunidadeId
      });

      // Salvar anexos após criar a tarefa
      if (ticketData.attachments && ticketData.attachments.length > 0) {
        for (const attachment of ticketData.attachments) {
          try {
            await ticketAttachmentsRepoSupabase.create({
              ticket_id: newTicket.id,
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

      toast({
        title: "Tarefa criada com sucesso!",
        description: `A tarefa "${newTicket.title}" foi criada e está disponível na lista.`,
      });

      router.push('/tarefas');
    } catch (error) {
      logger.error('Erro ao criar tarefa:', error);
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
    router.push('/tarefas');
  };

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
