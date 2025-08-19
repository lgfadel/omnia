import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PriorityBadge } from '@/components/ui/priority-badge';
import { CommentsList } from '@/components/atas/CommentsList';
import { CommentInput } from '@/components/atas/CommentInput';
import { AttachmentsList } from '@/components/atas/AttachmentsList';
import { useTicketsStore } from '@/store/tickets.store';
import { useTicketStatusStore } from '@/store/ticketStatus.store';
import { Ticket } from '@/repositories/ticketsRepo.supabase';
import { ArrowLeft, Edit, Trash2, Calendar, User, Tag } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  
  const { getTicketById, deleteTicket } = useTicketsStore();
  const { statuses, loadStatuses } = useTicketStatusStore();

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  useEffect(() => {
    const loadTicket = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const ticketData = await getTicketById(id);
        setTicket(ticketData);
      } catch (error) {
        console.error('Erro ao carregar ticket:', error);
        toast({
          title: 'Erro ao carregar ticket',
          description: 'Não foi possível carregar os dados do ticket.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadTicket();
  }, [id, getTicketById]);

  const handleDelete = async () => {
    if (!ticket || !confirm('Tem certeza que deseja deletar este ticket?')) return;

    try {
      await deleteTicket(ticket.id);
      toast({
        title: 'Ticket deletado',
        description: 'O ticket foi deletado com sucesso.',
      });
      navigate('/tickets');
    } catch (error) {
      console.error('Erro ao deletar ticket:', error);
      toast({
        title: 'Erro ao deletar ticket',
        description: 'Não foi possível deletar o ticket.',
        variant: 'destructive',
      });
    }
  };

  const getStatusById = (statusId: string) => {
    return statuses.find(s => s.id === statusId);
  };

  if (loading) {
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

  const status = getStatusById(ticket.statusId);

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
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-primary">{ticket.title}</h1>
            <p className="text-muted-foreground">
              Criado em {format(ticket.createdAt, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={`/tickets/${ticket.id}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </Link>
            <Button 
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Deletar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Descrição</CardTitle>
              </CardHeader>
              <CardContent>
                {ticket.description ? (
                  <p className="whitespace-pre-wrap">{ticket.description}</p>
                ) : (
                  <p className="text-muted-foreground italic">Nenhuma descrição fornecida</p>
                )}
              </CardContent>
            </Card>

            {ticket.attachments && ticket.attachments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Anexos</CardTitle>
                </CardHeader>
                <CardContent>
                  <AttachmentsList
                    attachments={ticket.attachments}
                    canDelete={false}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Comentários ({ticket.commentCount})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CommentInput 
                  onSubmit={async () => {
                    // TODO: Implementar criação de comentários para tickets
                  }}
                />
                <CommentsList comments={ticket.comments || []} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Detalhes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Status</div>
                  {status && (
                    <Badge 
                      className="text-white font-medium"
                      style={{ backgroundColor: status.color }}
                    >
                      {status.name}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Prioridade</div>
                  <PriorityBadge priority={ticket.priority} />
                </div>

                {ticket.dueDate && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Vencimento
                    </div>
                    <p className="text-sm">
                      {format(ticket.dueDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                )}

                {ticket.ticket && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Ticket</div>
                    <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {ticket.ticket}
                    </p>
                  </div>
                )}

                {ticket.assignedTo && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Responsável
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                        style={{ backgroundColor: ticket.assignedTo.color }}
                      >
                        {ticket.assignedTo.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm">{ticket.assignedTo.name}</span>
                    </div>
                  </div>
                )}

                {ticket.createdBy && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Criado por</div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                        style={{ backgroundColor: ticket.createdBy.color }}
                      >
                        {ticket.createdBy.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm">{ticket.createdBy.name}</span>
                    </div>
                  </div>
                )}

                {ticket.tags && ticket.tags.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Tags
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ticket.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}