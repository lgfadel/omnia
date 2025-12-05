import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Administradora } from "@/repositories/administradorasRepo.supabase"

const ADMIN_TYPES = ["Administradora", "Contabilidade", "Construtora", "Advogado"] as const

const adminSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  tipo: z.enum(ADMIN_TYPES),
  ativo: z.boolean().default(true),
});

type AdminFormData = z.infer<typeof adminSchema>

interface AdminFormProps {
  administradora?: Administradora
  onSubmit: (data: AdminFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function AdminForm({ administradora, onSubmit, onCancel, isLoading }: AdminFormProps) {
  const form = useForm<z.infer<typeof adminSchema>>({
    // TODO: remover cast quando @hookform/resolvers suportar Zod 3.24
    resolver: zodResolver(adminSchema as any),
    defaultValues: {
      nome: administradora?.nome || "",
      tipo: administradora?.tipo || "Administradora",
      ativo: administradora?.ativo ?? true,
    },
  });

  const onFormSubmit = async (data: AdminFormData) => {
    try {
      await onSubmit(data)
    } catch (error) {
      console.error('Erro ao salvar administradora:', error)
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          {administradora ? 'Editar Administradora' : 'Nova Administradora'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              {...form.register("nome")}
              placeholder="Nome da administradora"
              disabled={isLoading}
            />
            {form.formState.errors.nome && (
              <p className="text-sm text-red-500">{form.formState.errors.nome.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo *</Label>
            <Select
              value={form.watch("tipo")}
              onValueChange={(value) => form.setValue("tipo", value as typeof ADMIN_TYPES[number])}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {ADMIN_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.tipo && (
              <p className="text-sm text-red-500">{form.formState.errors.tipo.message}</p>
            )}
          </div>



          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}