import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Administradora } from "@/repositories/administradorasRepo.supabase"

const adminSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
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
    resolver: zodResolver(adminSchema),
    defaultValues: {
      nome: administradora?.nome || "",
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