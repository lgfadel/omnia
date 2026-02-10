"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Edit, Building2, Users, DollarSign, MapPin, User, Phone, Mail, MessageSquare } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { BreadcrumbOmnia } from '@/components/ui/breadcrumb-omnia';
import { CrmStatusBadge } from '@/components/ui/badge-crm-status';
import { CrmCommentsList } from '@/components/crm/CrmCommentsList';
import { CrmCommentInput } from '@/components/crm/CrmCommentInput';
import { TarefasOportunidade } from '@/components/TarefasOportunidade';
import { useCrmLeadsStore } from '@/stores/crmLeads.store';
import { CrmLead } from '@/repositories/crmLeadsRepo.supabase';
import { toast } from '@/hooks/use-toast'
import { logger } from '@/lib/logging';

// Função para formatar telefone
const formatPhone = (value: string) => {
  if (!value) return value;
  
  const numericValue = value.replace(/\D/g, '').substring(0, 11);
  
  if (numericValue.length === 10) {
    return numericValue.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  else if (numericValue.length === 11) {
    return numericValue.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  else if (numericValue.length > 6) {
    if (numericValue.length <= 10) {
      return numericValue.replace(/(\d{2})(\d{0,4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    } else {
      return numericValue.replace(/(\d{2})(\d{0,5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    }
  }
  else if (numericValue.length > 2) {
    return numericValue.replace(/(\d{2})(\d{0,5})/, '($1) $2');
  }
  else if (numericValue.length > 0) {
    return numericValue.replace(/(\d{0,2})/, '($1');
  }
  
  return numericValue;
};

export default function CrmLeadDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { leads, fetchLeads, loading } = useCrmLeadsStore();
  const [lead, setLead] = useState<CrmLead | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadLead = useCallback(async () => {
    if (!id) return;
    
    try {
      const existingLead = leads.find(l => l.id === id);
      if (existingLead) {
        setLead(existingLead);
      } else {
        await fetchLeads();
        const updatedLead = leads.find(l => l.id === id);
        if (updatedLead) {
          setLead(updatedLead);
        } else {
          toast({
            title: 'Erro',
            description: 'Lead não encontrado',
            variant: 'destructive',
          })
          router.push('/crm');
        }
      }
    } catch (error) {
      logger.error(`Erro ao carregar lead: ${error}`);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar lead',
        variant: 'destructive',
      })
    }
  }, [id, leads, fetchLeads, router]);

  useEffect(() => {
    if (id) {
      loadLead();
    }
  }, [id, refreshKey, loadLead]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleEdit = () => {
    router.push(`/crm/edit/${id}`);
  };

  const formatCurrency = (value: number | undefined) => {
    if (!value) return 'Não informado';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || !lead) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  const totalFuncionarios = (lead.numero_funcionarios_proprios || 0) + (lead.numero_funcionarios_terceirizados || 0);

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Oportunidades", href: "/crm" },
            { label: lead.cliente, isActive: true }
          ]} 
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{lead.cliente}</h1>
            <div className="flex items-center gap-2 mt-1">
              <CrmStatusBadge statusId={lead.status} />
              <span className="text-sm text-muted-foreground">
                Criado em {formatDate(lead.created_at)}
              </span>
            </div>
          </div>
          <Button onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna principal - Comentários */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comentários ({lead.comment_count || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CrmCommentInput 
                  leadId={lead.id}
                  onCommentAdded={handleRefresh}
                />
                <CrmCommentsList 
                  leadId={lead.id}
                  onCommentsChange={handleRefresh}
                />
              </CardContent>
            </Card>

            {/* Tarefas Relacionadas */}
            <TarefasOportunidade oportunidadeId={lead.id} />
          </div>

          {/* Sidebar - Detalhes */}
          <div className="space-y-6">
            {/* Informações básicas */}
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Status</div>
                  <CrmStatusBadge statusId={lead.status} />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Unidades
                  </div>
                  <div className="text-sm">{lead.numero_unidades || 'Não informado'}</div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Funcionários
                  </div>
                  <div className="text-sm">
                    {totalFuncionarios > 0 ? (
                      <div>
                        <div>Total: {totalFuncionarios}</div>
                        {lead.numero_funcionarios_proprios && (
                          <div className="text-xs text-muted-foreground">
                            Próprios: {lead.numero_funcionarios_proprios}
                          </div>
                        )}
                        {lead.numero_funcionarios_terceirizados && (
                          <div className="text-xs text-muted-foreground">
                            Terceirizados: {lead.numero_funcionarios_terceirizados}
                          </div>
                        )}
                      </div>
                    ) : (
                      'Não informado'
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Valor da Proposta
                  </div>
                  <div className="text-sm">{formatCurrency(lead.valor_proposta)}</div>
                </div>

                {lead.administradora_atual && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Administradora Atual</div>
                    <div className="text-sm">{lead.administradora_atual}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Endereço */}
            {(lead.logradouro || lead.cep) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Endereço
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {lead.logradouro && (
                    <div>
                      <div className="text-sm">
                        {lead.logradouro}
                        {lead.numero && `, ${lead.numero}`}
                        {lead.complemento && `, ${lead.complemento}`}
                      </div>
                      {lead.bairro && (
                        <div className="text-sm text-muted-foreground">
                          {lead.bairro}
                        </div>
                      )}
                      {(lead.cidade || lead.estado) && (
                        <div className="text-sm text-muted-foreground">
                          {lead.cidade}{lead.cidade && lead.estado && ', '}{lead.estado}
                        </div>
                      )}
                    </div>
                  )}
                  {lead.cep && (
                    <div className="text-sm text-muted-foreground">
                      CEP: {lead.cep}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Dados do Síndico */}
            {(lead.sindico_nome || lead.sindico_telefone || lead.sindico_email || lead.sindico_whatsapp) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Síndico
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {lead.sindico_nome && (
                    <div>
                      <div className="text-sm font-medium">Nome</div>
                      <div className="text-sm">{lead.sindico_nome}</div>
                    </div>
                  )}
                  {lead.sindico_telefone && (
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Telefone
                      </div>
                      <div className="text-sm">{formatPhone(lead.sindico_telefone)}</div>
                    </div>
                  )}
                  {lead.sindico_email && (
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </div>
                      <div className="text-sm">{lead.sindico_email}</div>
                    </div>
                  )}
                  {lead.sindico_whatsapp && (
                    <div>
                      <div className="text-sm font-medium">WhatsApp</div>
                      <div className="text-sm">{formatPhone(lead.sindico_whatsapp)}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Observações */}
            {lead.observacoes && (
              <Card>
                <CardHeader>
                  <CardTitle>Observações</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm whitespace-pre-wrap">{lead.observacoes}</div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
