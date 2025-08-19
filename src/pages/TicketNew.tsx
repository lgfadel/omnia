import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { TicketForm } from '@/components/tickets/TicketForm';
import { useTicketsStore } from '@/store/tickets.store';
import { useSecretariosStore } from '@/store/secretarios.store';
import { Ticket } from '@/repositories/ticketsRepo.supabase';
import { UserRef } from '@/data/fixtures';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TicketNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { createTicket } = useTicketsStore();
  const { secretarios, loadSecretarios } = useSecretariosStore();

  useEffect(() => {
    loadSecretarios();
  }, [loadSecretarios]);

  const handleSubmit = async (ticketData: Partial<Ticket>) => {
    setLoading(true);
    try {
      const newTicket = await createTicket({
        title: ticketData.title!,
        description: ticketData.description,
        priority: ticketData.priority!,
        dueDate: ticketData.dueDate,
        ticket: ticketData.ticket,
        statusId: ticketData.statusId!,
        assignedTo: ticketData.assignedTo,
        tags: ticketData.tags || [],
        attachments: ticketData.attachments || [],
      });

      toast({
        title: 'Ticket criado com sucesso!',
        description: `O ticket "${newTicket.title}" foi criado.`,
      });

      navigate(`/tickets/${newTicket.id}`);
    } catch (error) {
      console.error('Erro ao criar ticket:', error);
      toast({
        title: 'Erro ao criar ticket',
        description: 'Ocorreu um erro ao criar o ticket. Tente novamente.',
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

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/tickets')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary">Novo Ticket</h1>
            <p className="text-muted-foreground">
              Crie um novo ticket para registrar uma solicitação ou problema
            </p>
          </div>
        </div>

        <TicketForm
          users={users}
          onSubmit={handleSubmit}
          loading={loading}
        />
      </div>
    </Layout>
  );
}