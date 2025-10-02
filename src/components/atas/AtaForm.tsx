import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusSelect } from "./StatusSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { Ata, UserRef } from "@/data/types";
import { useAtasStore } from "@/store/atas.store";
import { useTagsStore } from "@/store/tags.store";
import { useCondominiumStore } from "@/store/condominiums.store";
import { atasRepoSupabase } from "@/repositories/atasRepo.supabase";
import { TagInput } from "./TagInput";
import { QuickCondominiumDialog } from "@/components/condominiums/QuickCondominiumDialog";
import { logger } from '../../lib/logging';

const ataSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  meetingDate: z.string().optional(),
  secretaryId: z.string().optional(),
  responsibleId: z.string().optional(),
  statusId: z.string().min(1, "Status é obrigatório"),
  condominiumId: z.string().optional(),
  ticket: z.string().optional(),
  tags: z.string().optional()
});
type AtaFormData = z.infer<typeof ataSchema>;
interface AtaFormProps {
  ata?: Ata;
  onSubmit: (data: Omit<AtaFormData, 'tags'> & {
    tags: string[];
  }) => void;
  onCancel: () => void;
  loading?: boolean;
}
export function AtaForm({
  ata,
  onSubmit,
  onCancel,
  loading
}: AtaFormProps) {
  const {
    statuses
  } = useAtasStore();
  const { loadTags } = useTagsStore();
  const { condominiums, loadCondominiums } = useCondominiumStore();
  const [users, setUsers] = useState<UserRef[]>([]);
  const [tags, setTags] = useState<string[]>(ata?.tags || []);
  const [showQuickCondominiumDialog, setShowQuickCondominiumDialog] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [userData] = await Promise.all([
          atasRepoSupabase.getUsers(),
          loadTags(),
          loadCondominiums()
        ]);
        setUsers(userData);
      } catch (error) {
        logger.error('Erro ao carregar dados:', error);
      }
    };
    loadData();
  }, [loadTags, loadCondominiums]);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: {
      errors
    }
  } = useForm<AtaFormData>({
    resolver: zodResolver(ataSchema),
    defaultValues: {
      title: ata?.title || "",
      description: ata?.description || "",
      meetingDate: ata?.meetingDate || "",
      secretaryId: ata?.secretary?.id || "",
      responsibleId: ata?.responsible?.id || "",
      statusId: ata?.statusId || statuses.find(s => s.isDefault)?.id || "",
      condominiumId: ata?.condominiumId || "",
      ticket: ata?.ticket || "",
      tags: ""
    }
  });
  const handleCondominiumCreated = (condominiumId: string) => {
    // Recarrega a lista de condomínios
    loadCondominiums();
    // Seleciona o condomínio recém-criado
    setValue("condominiumId", condominiumId);
  };

  const onFormSubmit = (data: AtaFormData) => {
    onSubmit({
      ...data,
      tags
    });
  };
  return (
     <>
       <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>{ata ? 'Editar Ata' : 'Nova Ata'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Informações Básicas</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input id="title" {...register("title")} placeholder="Ex: Assembleia Ordinária — Bloco A" />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="meetingDate">Data da Assembleia</Label>
                <Input id="meetingDate" type="date" {...register("meetingDate")} />
              </div>
            </div>

            
          </div>

          <Separator />

          {/* Responsabilidades */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Responsabilidades</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Secretário</Label>
                <Select onValueChange={value => setValue("secretaryId", value)} defaultValue={watch("secretaryId")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o secretário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(user => 
                      user.roles.includes('SECRETARIO') || user.roles.includes('ADMIN')
                    ).map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select onValueChange={value => setValue("responsibleId", value)} defaultValue={watch("responsibleId")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Status e Classificação */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status e Classificação</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status *</Label>
                <StatusSelect statuses={statuses} value={watch("statusId")} onValueChange={value => setValue("statusId", value)} className="w-full" />
                {errors.statusId && <p className="text-sm text-destructive">{errors.statusId.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Condomínio</Label>
                <div className="flex gap-2">
                  <Select onValueChange={value => setValue("condominiumId", value)} defaultValue={watch("condominiumId")}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione o condomínio" />
                    </SelectTrigger>
                    <SelectContent>
                      {condominiums.map(condominium => (
                        <SelectItem key={condominium.id} value={condominium.id}>
                          {condominium.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowQuickCondominiumDialog(true)}
                    title="Cadastrar novo condomínio"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Ticket */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Informações Adicionais</h3>
            
            <div className="space-y-2">
              <Label htmlFor="ticket">Ticket/Código</Label>
              <Input id="ticket" {...register("ticket")} placeholder="Ex: TCK-12345" />
            </div>
          </div>

          <Separator />

          {/* Tags */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Tags</h3>
            <TagInput 
              tags={tags} 
              onTagsChange={setTags} 
            />
          </div>

          <Separator />

          {/* Ações */}
          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : ata ? "Atualizar" : "Criar Ata"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <QuickCondominiumDialog
      open={showQuickCondominiumDialog}
      onOpenChange={setShowQuickCondominiumDialog}
      onCondominiumCreated={handleCondominiumCreated}
    />
    </>
  );
}