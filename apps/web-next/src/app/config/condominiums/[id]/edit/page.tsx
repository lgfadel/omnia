"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { Button } from "@/components/ui/button";
import { CondominiumForm, type CondominiumFormValues } from "@/components/condominiums/CondominiumForm";
import { useCondominiumStore } from "@/stores/condominiums.store";
import { Condominium } from "@/repositories/condominiumsRepo.supabase";
import { useToast } from "@/hooks/use-toast";
import { handleSupabaseError, createErrorContext } from "@/lib/errorHandler";
import { logger } from "@/lib/logging";

export default function EditCondominiumPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { toast } = useToast();
  const { condominiums, getCondominiumById, updateCondominium, loading } = useCondominiumStore();

  const [condominium, setCondominium] = useState<Condominium | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadingCondominium, setLoadingCondominium] = useState(true);

  const loadCondominium = useCallback(async () => {
    if (!id) return;

    const fromStore = condominiums.find((c) => c.id === id);
    if (fromStore) {
      setCondominium(fromStore);
      setLoadingCondominium(false);
      return;
    }

    try {
      const fetched = await getCondominiumById(id);
      if (fetched) {
        setCondominium(fetched);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      logger.error(`EditCondominiumPage: Error loading condominium: ${error}`);
      setNotFound(true);
    } finally {
      setLoadingCondominium(false);
    }
  }, [id, condominiums, getCondominiumById]);

  useEffect(() => {
    loadCondominium();
  }, [loadCondominium]);

  const breadcrumbItems = [
    { label: "Configurações", href: "/config" },
    { label: "Condomínios", href: "/config/condominiums" },
    { label: condominium?.name || "Editar", isActive: true },
  ];

  const handleSubmit = async (data: CondominiumFormValues) => {
    if (!id) return;
    logger.debug(`EditCondominiumPage: Updating condominium ${id}`);
    try {
      await updateCondominium(id, data);
      toast({
        title: "Condomínio atualizado!",
        description: `O condomínio "${data.name}" foi atualizado com sucesso.`,
      });
      router.push("/config/condominiums");
    } catch (error) {
      logger.error(`EditCondominiumPage: Error updating condominium: ${error}`);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext("update", "condomínio", "omnia_condominiums")
      );
      toast({
        title: "Erro",
        description: treatedError.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-6">
        <BreadcrumbOmnia items={breadcrumbItems} />

        {loadingCondominium ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            Carregando...
          </div>
        ) : notFound || !condominium ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <p className="text-muted-foreground">Condomínio não encontrado.</p>
            <Button variant="outline" onClick={() => router.push("/config/condominiums")}>
              Voltar para condomínios
            </Button>
          </div>
        ) : (
          <CondominiumForm
            condominium={condominium}
            onSubmit={handleSubmit}
            onCancel={() => router.push("/config/condominiums")}
            isLoading={loading}
          />
        )}
      </div>
    </Layout>
  );
}
