"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { BreadcrumbOmnia } from '@/components/ui/breadcrumb-omnia';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PriorityBadge } from '@/components/ui/priority-badge';
import { TicketCommentsList } from '@/components/tickets/TicketCommentsList';
import { TicketCommentInput } from '@/components/tickets/TicketCommentInput';
import { TicketAttachmentsList } from '@/components/tickets/TicketAttachmentsList';
import { TicketFileUploader } from '@/components/tickets/TicketFileUploader';
import { useTarefasStore } from '@/store/tarefas.store';
import { useTarefaStatusStore } from '@/store/tarefaStatus.store';
import { useTagsStore } from '@/store/tags.store';
import { Tarefa } from '@/repositories/tarefasRepo.supabase';
import { Edit, Trash2, Calendar, User, Tag, Building2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCrmLead } from '@/hooks/useCrmLead';
import { logger } from '@/lib/logging';

export default function TicketDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [ticket, setTicket] = useState<Tarefa | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { getTarefaById, deleteTarefa } = useTarefasStore();
  const { statuses, loadStatuses } = useTarefaStatusStore();
  const { tags, loadTags } = useTagsStore();
  
  const { lead: oportunidade, loading: loadingOportunidade } = useCrmLead(ticket?.oportunidadeId);

  useEffect(() => {
    loadStatuses();
    loadTags();
  }, [loadStatuses, loadTags]);

  useEffect(() => {
    const loadTicket = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const ticketData = await getTarefaById(id);
        setTicket(ticketData);
      } catch (error) {
        logger.error('Erro ao carregar ticket:', error);
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
  }, [id, getTarefaById]);

  const handleDelete = async () => {
    if (!ticket || !confirm('Tem certeza que deseja deletar este ticket?')) return;

    try {
      await deleteTarefa(ticket.id);
      toast({
        title: 'Ticket deletado',
        description: 'O ticket foi deletado com sucesso.',
      });
      router.push('/tarefas');
    } catch (error) {
      logger.error('Erro ao deletar ticket:', error);
      toast({
        title: 'Erro ao deletar ticket',
        description: 'Não foi possível deletar o ticket.',
        variant: 'destructive',
      });
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
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
            <Button onClick={() => router.push('/tarefas')}>
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
        <BreadcrumbOmnia 
          items={[
            { label: "Início", href: "/" },
            { label: "Tarefas", href: "/tarefas" },
            { label: ticket.title }
          ]}
        />
        
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{ticket.title}</h1>
            <p className="text-muted-foreground">
              Criado em {format(ticket.createdAt, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/tarefas/${ticket.id}/edit`}>
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

        <Tabs defaultValue="resumo" className="space-y-6">
          <TabsList>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="anexos">
              Anexos ({(() => {
                const directAttachments = ticket.attachments?.length || 0;
                const commentAttachments = ticket.comments?.reduce((total, comment) => 
                  total + (comment.attachments?.length || 0), 0) || 0;
                return directAttachments + commentAttachments;
              })()})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumo">
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

                <Card>
                  <CardHeader>
                    <CardTitle>Comentários ({ticket.commentCount})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <TicketCommentInput 
                      ticketId={ticket.id}
                      onCommentAdded={handleRefresh}
                    />
                    <TicketCommentsList 
                      ticketId={ticket.id}
                      onCommentsChange={handleRefresh}
                    />
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

                    {ticket.oportunidadeId && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Oportunidade
                        </div>
                        {loadingOportunidade ? (
                          <div className="text-sm text-muted-foreground">Carregando...</div>
                        ) : oportunidade ? (
                          <div className="p-3 bg-muted/50 rounded-lg border">
                            <div className="flex items-center justify-between">
                              <div>
                                <Link 
                                  href={`/crm/${oportunidade.id}`}
                                  className="font-medium text-sm text-primary hover:underline"
                                >
                                  {oportunidade.cliente}
                                </Link>
                                {oportunidade.valor_proposta && (
                                  <p className="text-xs text-green-600 font-medium mt-1">
                                    {new Intl.NumberFormat('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL'
                                    }).format(oportunidade.valor_proposta)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Oportunidade não encontrada</div>
                        )}
                      </div>
                    )}

                    {ticket.tags && ticket.tags.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Tags
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ticket.tags.map((tagName) => {
                            const tagData = tags.find(t => t.name === tagName)
                            return (
                              <Badge 
                                key={tagName} 
                                style={{ 
                                  backgroundColor: tagData?.color || '#6366f1', 
                                  color: 'white' 
                                }}
                                className="border-none text-xs"
                              >
                                {tagName}
                              </Badge>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="anexos">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Adicionar Anexos</CardTitle>
                </CardHeader>
                <CardContent>
                  <TicketFileUploader 
                    ticketId={ticket.id} 
                    onFileUploaded={handleRefresh}
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Anexos da Tarefa</CardTitle>
                </CardHeader>
                <CardContent>
                  <TicketAttachmentsList ticketId={ticket.id} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
