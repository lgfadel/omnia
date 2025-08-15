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
import { X } from "lucide-react";
import { Ata, UserRef } from "@/data/fixtures";
import { useAtasStore } from "@/store/atas.store";
import { atasRepoSupabase } from "@/repositories/atasRepo.supabase";
const ataSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  meetingDate: z.string().optional(),
  secretaryId: z.string().optional(),
  statusId: z.string().min(1, "Status é obrigatório"),
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
  const [users, setUsers] = useState<UserRef[]>([]);
  const [tags, setTags] = useState<string[]>(ata?.tags || []);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const userData = await atasRepoSupabase.getUsers();
        setUsers(userData);
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      }
    };
    loadUsers();
  }, []);
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
      statusId: ata?.statusId || statuses.find(s => s.isDefault)?.id || "",
      ticket: ata?.ticket || "",
      tags: ""
    }
  });
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };
  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };
  const onFormSubmit = (data: AtaFormData) => {
    onSubmit({
      ...data,
      tags
    });
  };
  return <Card className="w-full max-w-4xl mx-auto">
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
                      {user.name} ({user.roles.includes('ADMIN') ? 'Admin' : 'Secretário'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Label htmlFor="ticket">Ticket/Código</Label>
                <Input id="ticket" {...register("ticket")} placeholder="Ex: TCK-12345" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map(tag => <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => handleRemoveTag(tag)} />
                  </Badge>)}
              </div>
              <div className="flex gap-2">
                <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleKeyPress} placeholder="Digite uma tag e pressione Enter" />
                <Button type="button" variant="outline" onClick={handleAddTag}>
                  Adicionar
                </Button>
              </div>
            </div>
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
    </Card>;
}