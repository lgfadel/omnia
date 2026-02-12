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
import { useRescisoesStore } from '@/stores/rescisoes.store';
import { useRescisaoStatusStore } from '@/stores/rescisaoStatus.store';
import { useTagsStore } from '@/stores/tags.store';
import { Rescisao } from '@/repositories/rescisaoRepo.supabase';
import { Edit, Trash2, Calendar, User, Tag } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logger } from '@/lib/logging';

export default function RescisaoDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [rescisao, setRescisao] = useState<Rescisao | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { getRescisaoById, deleteRescisao } = useRescisoesStore();
  const { statuses, loadStatuses } = useRescisaoStatusStore();
  const { tags, loadTags } = useTagsStore();

  useEffect(() => {
    loadStatuses();
    loadTags();
  }, [loadStatuses, loadTags]);

  useEffect(() => {
    const loadRescisao = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const rescisaoData = await getRescisaoById(id);
        setRescisao(rescisaoData);
      } catch (error) {
        logger.error('Erro ao carregar rescisão:', error);
        toast({
          title: 'Erro ao carregar rescisão',
          description: 'Não foi possível carregar os dados da rescisão.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadRescisao();
  }, [id, getRescisaoById, refreshKey]);

  const handleDelete = async () => {
    if (!rescisao || !confirm('Tem certeza que deseja deletar esta rescisão?')) return;

    try {
      await deleteRescisao(rescisao.id);
      toast({
        title: 'Rescisão deletada',
        description: 'A rescisão foi deletada com sucesso.',
      });
      router.push('/rescisoes');
    } catch (error) {
      logger.error('Erro ao deletar rescisão:', error);
      toast({
        title: 'Erro ao deletar rescisão',
        description: 'Não foi possível deletar a rescisão.',
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
          <div className="text-center">Carregando rescisão...</div>
        </div>
      </Layout>
    );
  }

  if (!rescisao) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Rescisão não encontrada</p>
            <Button onClick={() => router.push('/rescisoes')}>
              Voltar para Rescisões
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const status = getStatusById(rescisao.statusId);

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Início", href: "/" },
            { label: "Rescisões", href: "/rescisoes" },
            { label: rescisao.title }
          ]}
        />
        
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              {rescisao.ticketId != null && (
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  #{rescisao.ticketId}
                </span>
              )}
              <h1 className="text-2xl font-bold tracking-tight">{rescisao.title}</h1>
            </div>
            <p className="text-muted-foreground">
              Criado em {format(rescisao.createdAt, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/rescisoes/${rescisao.id}/edit`}>
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
          </TabsList>

          <TabsContent value="resumo">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Descrição</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {rescisao.description ? (
                      <p className="whitespace-pre-wrap">{rescisao.description}</p>
                    ) : (
                      <p className="text-muted-foreground italic">Nenhuma descrição fornecida</p>
                    )}
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
                      <PriorityBadge priority={rescisao.priority} />
                    </div>

                    {rescisao.dueDate && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Vencimento
                        </div>
                        <p className="text-sm">
                          {format(rescisao.dueDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    )}

                    {rescisao.ticketOcta && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Ticket</div>
                        <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {rescisao.ticketOcta}
                        </p>
                      </div>
                    )}

                    {rescisao.assignedTo && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Responsável
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                            style={{ backgroundColor: rescisao.assignedTo.color }}
                          >
                            {rescisao.assignedTo.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm">{rescisao.assignedTo.name}</span>
                        </div>
                      </div>
                    )}

                    {rescisao.tags && rescisao.tags.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Tags
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {rescisao.tags.map((tagName) => {
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
        </Tabs>
      </div>
    </Layout>
  );
}
