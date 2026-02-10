import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCondominiumStore } from "@/stores/condominiums.store";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { handleSupabaseError, createErrorContext } from "@/lib/errorHandler";

const quickCondominiumSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  address: z.string().optional(),
});

type QuickCondominiumFormData = z.infer<typeof quickCondominiumSchema>;

interface QuickCondominiumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCondominiumCreated?: (condominiumId: string) => void;
}

export function QuickCondominiumDialog({
  open,
  onOpenChange,
  onCondominiumCreated,
}: QuickCondominiumDialogProps) {
  const [loading, setLoading] = useState(false);
  const { createCondominium } = useCondominiumStore();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuickCondominiumFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(quickCondominiumSchema as any),
  });

  const onSubmit = async (data: QuickCondominiumFormData) => {
    setLoading(true);
    try {
      const condominiumData = {
        name: data.name,
        address: data.address || null,
      };
      const newCondominium = await createCondominium(condominiumData);
      toast({
        title: "Sucesso",
        description: "Condomínio cadastrado com sucesso!",
      });
      reset();
      onOpenChange(false);
      onCondominiumCreated?.(newCondominium.id);
    } catch (error) {
      const treatedError = handleSupabaseError(
        error,
        createErrorContext('create', 'condomínio', 'omnia_condominiums')
      );
      toast({
        title: "Erro",
        description: treatedError.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Condomínio</DialogTitle>
          <DialogDescription>
            Preencha os dados básicos do condomínio para cadastrá-lo rapidamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              {...register("name")}
              placeholder="Nome do condomínio"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder="Endereço completo"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
