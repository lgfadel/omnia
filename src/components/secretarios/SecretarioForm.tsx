import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserRef, Role } from "@/data/types"
import { USER_COLOR_PALETTE } from "@/lib/userColors"

const secretarioSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional().or(z.literal("")),
  roles: z.array(z.enum(["ADMIN", "SECRETARIO", "USUARIO"])).min(1, "Selecione pelo menos um cargo"),
  color: z.string().optional()
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
      password: "",
      roles: secretario?.roles || ["USUARIO"],
      color: secretario?.color || USER_COLOR_PALETTE[0]
    }
  })

  const watchedRoles = watch("roles")
  const watchedColor = watch("color")

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

          {!secretario && (
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                {...register("password")}
                placeholder="Deixe em branco para gerar automaticamente"
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Se não informada, será gerada uma senha temporária
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="roles">Cargos</Label>
            <div className="space-y-2">
              {["ADMIN", "SECRETARIO", "USUARIO"].map((role) => (
                <div key={role} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={role}
                    checked={watchedRoles.includes(role as Role)}
                    onChange={(e) => {
                      const currentRoles = watchedRoles;
                      if (e.target.checked) {
                        setValue("roles", [...currentRoles, role as Role]);
                      } else {
                        setValue("roles", currentRoles.filter(r => r !== role));
                      }
                    }}
                    disabled={isLoading}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor={role} className="text-sm font-normal cursor-pointer">
                    {role === "ADMIN" ? "Administrador" : 
                     role === "SECRETARIO" ? "Secretário" : "Usuário"}
                  </Label>
                </div>
              ))}
            </div>
            {errors.roles && (
              <p className="text-sm text-destructive">{errors.roles.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Cor do Avatar</Label>
            <div className="grid grid-cols-8 gap-2 p-2 border rounded-md">
              {USER_COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue("color", color, { shouldValidate: true, shouldDirty: true })}
                  disabled={isLoading}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    (watchedColor && watchedColor.trim() === color)
                      ? "border-primary scale-110"
                      : "border-muted-foreground/20 hover:border-muted-foreground/40"
                  }`}
                  style={{ backgroundColor: color }}
                  title={`Selecionar cor ${color}`}
                  aria-label={`Selecionar cor ${color}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Selecione uma cor para o avatar do usuário
            </p>
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