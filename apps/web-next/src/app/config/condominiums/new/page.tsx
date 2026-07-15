"use client";

import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { CondominiumForm, type CondominiumFormValues } from "@/components/condominiums/CondominiumForm";
import { useCondominiumStore } from "@/stores/condominiums.store";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { handleSupabaseError, createErrorContext } from "@/lib/errorHandler";
import { logger } from "@/lib/logging";

const breadcrumbItems = [
  { label: "Configurações", href: "/config" },
  { label: "Condomínios", href: "/config/condominiums" },
  { label: "Novo", isActive: true },
];

export default function NewCondominiumPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createCondominium, loading } = useCondominiumStore();

  const handleSubmit = async (data: CondominiumFormValues) => {
    logger.debug("NewCondominiumPage: Creating condominium");
    try {
      await createCondominium(data);
      toast({
        title: "Condomínio criado!",
        description: `O condomínio "${data.name}" foi criado com sucesso.`,
      });
      router.push("/config/condominiums");
    } catch (error) {
      logger.error(`NewCondominiumPage: Error creating condominium: ${error}`);
      const treatedError = handleSupabaseError(
        error,
        createErrorContext("create", "condomínio", "omnia_condominiums")
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
        <CondominiumForm
          onSubmit={handleSubmit}
          onCancel={() => router.push("/config/condominiums")}
          isLoading={loading}
        />
      </div>
    </Layout>
  );
}
