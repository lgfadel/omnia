import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { CrmLeadForm } from "@/components/crm/CrmLeadForm";
import { useCrmLeadsStore } from "@/store/crmLeads.store";
import { CrmLead } from "@/repositories/crmLeadsRepo.supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/components/auth/AuthProvider';
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function CrmLeadEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
          navigate('/crm');
        }
      } catch (error) {
        console.error('Erro ao carregar lead:', error);
        toast({
          title: 'Erro ao carregar lead',
          description: 'Não foi possível carregar os dados do lead.',
          variant: 'destructive',
        });
        navigate('/crm');
      } finally {
        setInitialLoading(false);
      }
    };

    loadLead();
  }, [id, fetchLeadById, navigate, toast]);

  const handleSuccess = () => {
    toast({
      title: 'Lead atualizado com sucesso!',
      description: `O lead "${lead?.cliente}" foi atualizado.`,
    });

    navigate(`/crm/${lead?.id}`);
  };

  const handleCancel = () => {
    navigate(`/crm/${id}`);
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
            <Button onClick={() => navigate('/crm')}>
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
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
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