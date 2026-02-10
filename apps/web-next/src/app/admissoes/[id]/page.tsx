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
import { AdmissaoCommentsList } from '@/components/admissoes/AdmissaoCommentsList';
import { useAdmissoesStore } from '@/stores/admissoes.store';
import { useAdmissaoStatusStore } from '@/stores/admissaoStatus.store';
import { useTagsStore } from '@/stores/tags.store';
import { Admissao } from '@/repositories/admissoesRepo.supabase';
import { Edit, Trash2, Calendar, User, Tag, Building2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdmissaoAttachmentsList } from '@/components/admissoes/AdmissaoAttachmentsList';
import { logger } from '@/lib/logging';

export default function AdmissaoDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [admissao, setAdmissao] = useState<Admissao | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { getAdmissaoById, deleteAdmissao } = useAdmissoesStore();
  const { statuses, loadStatuses } = useAdmissaoStatusStore();
  const { tags, loadTags } = useTagsStore();
  

  useEffect(() => {
    loadStatuses();
    loadTags();
  }, [loadStatuses, loadTags]);

  useEffect(() => {
    const loadAdmissao = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const admissaoData = await getAdmissaoById(id);
        setAdmissao(admissaoData);
      } catch (error) {
        logger.error('Erro ao carregar admissao:', error);
        toast({
          title: 'Erro ao carregar admissao',
          description: 'Não foi possível carregar os dados do admissao.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadAdmissao();
  }, [id, getAdmissaoById, refreshKey]);

  const handleDelete = async () => {
    if (!admissao || !confirm('Tem certeza que deseja deletar este admissao?')) return;

    try {
      await deleteAdmissao(admissao.id);
      toast({
        title: 'Admissao deletado',
        description: 'O admissao foi deletado com sucesso.',
      });
      router.push('/admissoes');
    } catch (error) {
      logger.error('Erro ao deletar admissao:', error);
      toast({
        title: 'Erro ao deletar admissao',
        description: 'Não foi possível deletar o admissao.',
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
          <div className="text-center">Carregando admissao...</div>
        </div>
      </Layout>
    );
  }

  if (!admissao) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Admissao não encontrado</p>
            <Button onClick={() => router.push('/admissoes')}>
              Voltar para Admissaos
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const status = getStatusById(admissao.statusId);

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Início", href: "/" },
            { label: "Admissaos", href: "/admissoes" },
            { label: admissao.title }
          ]}
        />
        
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              {admissao.ticketId != null && (
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  #{admissao.ticketId}
                </span>
              )}
              <h1 className="text-2xl font-bold tracking-tight">{admissao.title}</h1>
            </div>
            <p className="text-muted-foreground">
              Criado em {format(admissao.createdAt, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/admissoes/${admissao.id}/edit`}>
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
              Anexos ({admissao.attachmentCount || 0})
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
                    {admissao.description ? (
                      <p className="whitespace-pre-wrap">{admissao.description}</p>
                    ) : (
                      <p className="text-muted-foreground italic">Nenhuma descrição fornecida</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Comentários ({admissao.commentCount})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <AdmissaoCommentsList 
                      key={refreshKey}
                      admissaoId={admissao.id}
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
                      <PriorityBadge priority={admissao.priority} />
                    </div>

                    {admissao.dueDate && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Vencimento
                        </div>
                        <p className="text-sm">
                          {format(admissao.dueDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    )}

                    {admissao.ticketOcta && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Admissao</div>
                        <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {admissao.ticketOcta}
                        </p>
                      </div>
                    )}

                    {admissao.assignedTo && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Responsável
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                            style={{ backgroundColor: admissao.assignedTo.color }}
                          >
                            {admissao.assignedTo.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm">{admissao.assignedTo.name}</span>
                        </div>
                      </div>
                    )}


                    {admissao.tags && admissao.tags.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Tags
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {admissao.tags.map((tagName) => {
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
                  <CardTitle>Anexos</CardTitle>
                </CardHeader>
                <CardContent>
                  <AdmissaoAttachmentsList admissaoId={admissao.id} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
