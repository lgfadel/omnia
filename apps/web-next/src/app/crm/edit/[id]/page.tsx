"use client";

import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { CrmLeadForm } from "@/components/crm/CrmLeadForm";
import { useCrmLeadsStore } from "@/stores/crmLeads.store";
import { CrmLead } from "@/repositories/crmLeadsRepo.supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/components/auth/AuthProvider';
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { logger } from '@/lib/logging';

export default function CrmLeadEdit() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [lead, setLead] = useState<CrmLead | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const { fetchLeadById, updateLead } = useCrmLeadsStore();

  useEffect(() => {
    const loadLead = async () => {
      if (!id) return;
      
      setInitialLoading(true);
      try {
        const leadData = await fetchLeadById(id);
        if (leadData) {
          setLead(leadData);
        } else {
          toast({
            title: 'Lead não encontrado',
            description: 'O lead solicitado não foi encontrado.',
            variant: 'destructive',
          });
          router.push('/crm');
        }
      } catch (error) {
        logger.error(`Erro ao carregar lead: ${error}`);
        toast({
          title: 'Erro ao carregar lead',
          description: 'Não foi possível carregar os dados do lead.',
          variant: 'destructive',
        });
        router.push('/crm');
      } finally {
        setInitialLoading(false);
      }
    };

    loadLead();
  }, [id, fetchLeadById, router, toast]);

  const handleSuccess = () => {
    toast({
      title: 'Lead atualizado com sucesso!',
      description: `O lead "${lead?.cliente}" foi atualizado.`,
    });

    router.push(`/crm/${lead?.id}`);
  };

  const handleCancel = () => {
    router.push(`/crm/${id}`);
  };

  if (initialLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center">Carregando lead...</div>
        </div>
      </Layout>
    );
  }

  if (!lead) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Lead não encontrado</p>
            <Button onClick={() => router.push('/crm')}>
              Voltar para CRM
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
            { label: "Oportunidades", href: "/crm" },
            { label: lead.cliente, href: `/crm/${lead.id}` },
            { label: "Editar", isActive: true }
          ]} 
        />
        
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Editar Lead</h1>
          </div>

          <CrmLeadForm
            lead={lead}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </Layout>
  );
}
