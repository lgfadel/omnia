"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CondominiumSelect } from "@/components/condominiums/CondominiumSelect";
import type { Condominium } from "@/repositories/condominiumsRepo.supabase";
import type { Balancete } from "@/repositories/balancetesRepo.supabase";

const balanceteSchema = z.object({
  condominium_id: z.string().min(1, "Selecione um condomínio"),
  received_at: z.string().min(1, "Informe a data de recebimento"),
  competencia: z
    .string()
    .min(1, "Informe a competência")
    .regex(/^\d{2}\/\d{4}$/, "Formato inválido. Use MM/AAAA"),
  volumes: z.coerce.number().int().min(1, "Mínimo 1 volume"),
  observations: z.string().optional(),
});

type BalanceteFormData = z.infer<typeof balanceteSchema>;

interface BalanceteFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balancete?: Balancete | null;
  condominiums: Condominium[];
  onSubmit: (data: BalanceteFormData) => Promise<void>;
  isLoading?: boolean;
}

function formatCompetencia(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2, 6)}`;
}

function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function BalanceteForm({
  open,
  onOpenChange,
  balancete,
  condominiums,
  onSubmit,
  isLoading = false,
}: BalanceteFormProps) {
  const isEditing = !!balancete;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BalanceteFormData>({
    resolver: zodResolver(balanceteSchema),
    defaultValues: {
      condominium_id: "",
      received_at: getTodayISO(),
      competencia: "",
      volumes: 1,
      observations: "",
    },
  });

  const condominiumId = watch("condominium_id");
  const competencia = watch("competencia");

  // Encontrar o condomínio selecionado para verificar se é digital
  const selectedCondominium = condominiums.find(c => c.id === condominiumId);
  const isDigital = selectedCondominium?.balancete_digital ?? false;

  useEffect(() => {
    if (open) {
      if (balancete) {
        reset({
          condominium_id: balancete.condominium_id,
          received_at: balancete.received_at,
          competencia: balancete.competencia,
          volumes: balancete.volumes,
          observations: balancete.observations || "",
        });
      } else {
        reset({
          condominium_id: "",
          received_at: getTodayISO(),
          competencia: "",
          volumes: 1,
          observations: "",
        });
      }
    }
  }, [open, balancete, reset]);

  // Quando o condomínio mudar para digital, ajustar volumes para 1
  useEffect(() => {
    if (isDigital && !isEditing) {
      setValue("volumes", 1);
    }
  }, [isDigital, isEditing, setValue]);

  const onFormSubmit = async (data: BalanceteFormData) => {
    await onSubmit(data);
  };

  const handleCompetenciaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCompetencia(e.target.value);
    setValue("competencia", formatted, { shouldValidate: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Balancete" : "Novo Balancete"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere os dados do balancete."
              : "Preencha os dados para registrar um novo balancete."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="condominium_id">Condomínio *</Label>
            <CondominiumSelect
              condominiums={condominiums}
              value={condominiumId}
              onValueChange={(val) =>
                setValue("condominium_id", val, { shouldValidate: true })
              }
            />
            {errors.condominium_id && (
              <p className="text-sm text-destructive">
                {errors.condominium_id.message}
              </p>
            )}
            {isDigital && condominiumId && (
              <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                <span className="text-xs text-blue-700 dark:text-blue-300">
                  ℹ️ Este condomínio recebe balancete digital
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="received_at">
                {isDigital ? "Data de Publicação *" : "Data de Recebimento *"}
              </Label>
              <Input
                id="received_at"
                type="date"
                {...register("received_at")}
              />
              {errors.received_at && (
                <p className="text-sm text-destructive">
                  {errors.received_at.message}
                </p>
              )}
              {isDigital && (
                <p className="text-xs text-muted-foreground">
                  Para balancetes digitais, informe a data de publicação
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="competencia">Competência (MM/AAAA) *</Label>
              <Input
                id="competencia"
                placeholder="MM/AAAA"
                value={competencia}
                onChange={handleCompetenciaChange}
                maxLength={7}
              />
              {errors.competencia && (
                <p className="text-sm text-destructive">
                  {errors.competencia.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="volumes">Número de Volumes *</Label>
            <Input
              id="volumes"
              type="number"
              min={1}
              disabled={isDigital}
              value={isDigital ? 1 : watch("volumes") || ""}
              onChange={(e) => {
                if (!isDigital) {
                  const value = e.target.value ? parseInt(e.target.value, 10) : 1;
                  setValue("volumes", value, { shouldValidate: true });
                }
              }}
            />
            {errors.volumes && (
              <p className="text-sm text-destructive">
                {errors.volumes.message}
              </p>
            )}
            {isDigital && (
              <p className="text-xs text-muted-foreground">
                Balancetes digitais sempre possuem 1 volume
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              placeholder="Observações sobre o balancete..."
              rows={3}
              {...register("observations")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? "Salvando..."
                : isEditing
                ? "Salvar Alterações"
                : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
