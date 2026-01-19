import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Condominium } from "@/repositories/condominiumsRepo.supabase"

const condominiumSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  address: z.string().optional().nullable(),
})

type CondominiumFormData = z.infer<typeof condominiumSchema>

interface CondominiumFormProps {
  condominium?: Condominium
  onSubmit: (data: { name: string; address?: string | null }) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function CondominiumForm({ condominium, onSubmit, onCancel, isLoading }: CondominiumFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<CondominiumFormData>({
    resolver: zodResolver(condominiumSchema as any),
    defaultValues: {
      name: condominium?.name || "",
      address: condominium?.address || "",
    }
  })

  const onFormSubmit = async (data: CondominiumFormData) => {
    await onSubmit({
      name: data.name,
      address: data.address || null,
    })
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>
          {condominium ? "Editar Condomínio" : "Novo Condomínio"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Condomínio *</Label>
            <Input
              id="nome"
              {...register("name")}
              placeholder="Ex: Residencial Jardim das Flores"
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Textarea
              id="address"
              {...register("address")}
              placeholder="Rua, número, bairro, cidade - UF"
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : condominium ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
