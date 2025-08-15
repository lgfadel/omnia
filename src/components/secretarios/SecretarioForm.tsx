import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserRef } from "@/data/fixtures"

const secretarioSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  email: z.string().email("E-mail inválido"),
  role: z.enum(["ADMIN", "SECRETARIO", "LEITOR"], {
    required_error: "Cargo é obrigatório"
  })
})

type SecretarioFormData = z.infer<typeof secretarioSchema>

interface SecretarioFormProps {
  secretario?: UserRef
  onSubmit: (data: SecretarioFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function SecretarioForm({ secretario, onSubmit, onCancel, isLoading }: SecretarioFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<SecretarioFormData>({
    resolver: zodResolver(secretarioSchema),
    defaultValues: {
      name: secretario?.name || "",
      email: secretario?.email || "",
      role: secretario?.role || "SECRETARIO"
    }
  })

  const watchedRole = watch("role")

  const onFormSubmit = async (data: SecretarioFormData) => {
    await onSubmit(data)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {secretario ? "Editar Usuário" : "Novo Usuário"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Ex: Ana Silva Santos"
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="Ex: ana@empresa.com"
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Cargo</Label>
            <Select 
              value={watchedRole} 
              onValueChange={(value) => setValue("role", value as "ADMIN" | "SECRETARIO" | "LEITOR")}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Administrador</SelectItem>
                <SelectItem value="SECRETARIO">Secretário</SelectItem>
                <SelectItem value="LEITOR">Leitor</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-destructive">{errors.role.message}</p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Salvando..." : secretario ? "Atualizar" : "Criar"}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}