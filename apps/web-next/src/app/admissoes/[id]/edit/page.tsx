"use client";

import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { AdmissaoForm } from "@/components/admissoes/AdmissaoForm";
import { useAdmissoesStore } from "@/store/admissoes.store";
import { Admissao } from "@/repositories/admissoesRepo.supabase";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { logger } from '@/lib/logging';

export default function AdmissaoEdit() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { toast } = useToast();
  const [admissao, setAdmissao] = useState<Admissao | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const { getAdmissaoById } = useAdmissoesStore();

  useEffect(() => {
    const loadAdmissao = async () => {
      if (!id) return;
      
      setInitialLoading(true);
      try {
        const admissao = await getAdmissaoById(id);
        setAdmissao(admissao);
      } catch (error) {
        logger.error('Erro ao carregar admissão:', error);
        toast({
          title: 'Erro ao carregar admissão',
          description: 'Não foi possível carregar os dados da admissão.',
          variant: 'destructive',
        });
        router.push('/admissoes');
      } finally {
        setInitialLoading(false);
      }
    };

    loadAdmissao();
  }, [id, getAdmissaoById, router, toast]);

  if (initialLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center">Carregando admissão...</div>
        </div>
      </Layout>
    );
  }

  if (!admissao) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Admissão não encontrada</p>
            <Button onClick={() => router.push('/admissoes')}>
              Voltar para Admissões
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
            { label: "Admissões", href: "/admissoes" },
            { label: admissao.title, href: `/admissoes/${admissao.id}` },
            { label: "Editar", isActive: true }
          ]} 
        />
        
        <div className="max-w-4xl mx-auto">
          <AdmissaoForm
            admissao={admissao}
            mode="edit"
          />
        </div>
      </div>
    </Layout>
  );
}
