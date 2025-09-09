import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Status } from "@/data/fixtures"

const crmStatusSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(50, "Nome deve ter no máximo 50 caracteres"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor deve estar no formato hexadecimal (#RRGGBB)")
})

type CrmStatusFormData = z.infer<typeof crmStatusSchema>

interface CrmStatusFormProps {
  status?: Status
  onSubmit: (data: CrmStatusFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const colorPresets = [
  "#f59e0b", // Amarelo
  "#3b82f6", // Azul
  "#10b981", // Verde
  "#ef4444", // Vermelho
  "#8b5cf6", // Roxo
  "#f97316", // Laranja
  "#06b6d4", // Ciano
  "#84cc16", // Lima
  "#ec4899", // Rosa
  "#6b7280"  // Cinza
]

export function CrmStatusForm({ status, onSubmit, onCancel, isLoading }: CrmStatusFormProps) {
  const [selectedColor, setSelectedColor] = useState(status?.color || "#f59e0b")

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<CrmStatusFormData>({
    resolver: zodResolver(crmStatusSchema),
    defaultValues: {
      name: status?.name || "",
      color: status?.color || "#f59e0b"
    }
  })

  const handleColorChange = (color: string) => {
    setSelectedColor(color)
    setValue("color", color)
  }

  const onFormSubmit = async (data: CrmStatusFormData) => {
    await onSubmit(data)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {status ? "Editar Status do CRM" : "Novo Status do CRM"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Status</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Ex: Em Negociação"
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="space-y-3">
              {/* Preview */}
              <div className="flex items-center gap-3">
                <Badge 
                  variant="secondary" 
                  style={{ backgroundColor: selectedColor + '20', color: selectedColor }}
                  className="border-0"
                >
                  Visualização
                </Badge>
                <span className="text-sm text-muted-foreground">{selectedColor}</span>
              </div>
              
              {/* Color Input */}
              <Input
                type="color"
                value={selectedColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-20 h-10 p-1 border rounded cursor-pointer"
                disabled={isLoading}
              />
              
              {/* Color Presets */}
              <div>
                <Label className="text-sm text-muted-foreground">Cores sugeridas:</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {colorPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleColorChange(color)}
                      className={`w-8 h-8 rounded border-2 ${
                        selectedColor === color ? 'border-foreground' : 'border-border'
                      }`}
                      style={{ backgroundColor: color }}
                      disabled={isLoading}
                    />
                  ))}
                </div>
              </div>
            </div>
            {errors.color && (
              <p className="text-sm text-destructive">{errors.color.message}</p>
            )}
          </div>

          {/* Hidden input to ensure color is submitted */}
          <input type="hidden" {...register("color")} />

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Salvando..." : status ? "Atualizar" : "Criar"}
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