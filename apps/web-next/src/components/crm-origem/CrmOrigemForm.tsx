import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CrmOrigem } from "@/repositories/crmOrigensRepo.supabase"

const crmOrigemSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(50, "Nome deve ter no máximo 50 caracteres"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor deve estar no formato hexadecimal (#RRGGBB)")
})

type CrmOrigemFormData = z.infer<typeof crmOrigemSchema>

interface CrmOrigemFormProps {
  origem?: CrmOrigem | null
  onSubmit: (data: CrmOrigemFormData) => void
  onCancel: () => void
  isLoading?: boolean
}

const colorOptions = [
  "#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", 
  "#f97316", "#06b6d4", "#84cc16", "#ec4899", "#6b7280"
]

export function CrmOrigemForm({ origem, onSubmit, onCancel, isLoading }: CrmOrigemFormProps) {
  const [selectedColor, setSelectedColor] = useState(origem?.color || "#f59e0b")

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<CrmOrigemFormData>({
    // TODO: remover cast quando resolver suportar Zod 3.24
    resolver: zodResolver(crmOrigemSchema as any),
    defaultValues: {
      name: origem?.name || "",
      color: origem?.color || "#f59e0b"
    }
  })

  const handleColorSelect = (color: string) => {
    setSelectedColor(color)
    setValue("color", color)
  }

  const onFormSubmit = (data: CrmOrigemFormData) => {
    onSubmit(data)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>
          {origem ? "Editar Origem" : "Nova Origem"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Origem</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Ex: Indicação, Site, Redes Sociais..."
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="grid grid-cols-5 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 ${
                    selectedColor === color ? "border-gray-800" : "border-gray-300"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorSelect(color)}
                  disabled={isLoading}
                />
              ))}
            </div>
            <Input
              {...register("color")}
              value={selectedColor}
              onChange={(e) => handleColorSelect(e.target.value)}
              placeholder="#f59e0b"
              className="mt-2"
              disabled={isLoading}
            />
            {errors.color && (
              <p className="text-sm text-red-500">{errors.color.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <Badge 
              style={{ 
                backgroundColor: selectedColor + '20',
                color: selectedColor,
                borderColor: selectedColor + '40'
              }}
              className="border"
            >
              {register("name").name ? "Nome da origem" : "Preview"}
            </Badge>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? "Salvando..." : origem ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}