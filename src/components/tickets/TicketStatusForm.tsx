import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TarefaStatus } from "@/repositories/tarefaStatusRepo.supabase"

const ticketStatusSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(50, "Nome deve ter no máximo 50 caracteres"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor deve estar no formato hexadecimal (#RRGGBB)")
})

type TicketStatusFormData = z.infer<typeof ticketStatusSchema>

interface TicketStatusFormProps {
  status?: TarefaStatus
  onSubmit: (data: TicketStatusFormData) => Promise<void>
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
  "#6b7280", // Cinza
]

export function TicketStatusForm({ status, onSubmit, onCancel, isLoading }: TicketStatusFormProps) {
  const [selectedColor, setSelectedColor] = useState(status?.color || colorPresets[0])

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TicketStatusFormData>({
    resolver: zodResolver(ticketStatusSchema),
    defaultValues: {
      name: status?.name || "",
      color: status?.color || colorPresets[0],
    },
  })

  const handleColorSelect = (color: string) => {
    setSelectedColor(color)
    setValue("color", color)
  }

  const onFormSubmit = async (data: TicketStatusFormData) => {
    await onSubmit(data)
    if (!status) {
      // Reset form for new status
      setSelectedColor(colorPresets[0])
      setValue("name", "")
      setValue("color", colorPresets[0])
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {status ? "Editar Status de Ticket" : "Novo Status de Ticket"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome do Status</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Ex: Em Análise"
            />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label>Cor do Status</Label>
            <div className="space-y-3 mt-2">
              {/* Color Presets */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Cores sugeridas:</p>
                <div className="flex flex-wrap gap-2">
                  {colorPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        selectedColor === color 
                          ? "border-primary ring-2 ring-primary/50" 
                          : "border-border hover:border-primary/50"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => handleColorSelect(color)}
                    />
                  ))}
                </div>
              </div>

              {/* Custom Color Input */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Ou escolha uma cor personalizada:</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => handleColorSelect(e.target.value)}
                    className="w-12 h-8 border border-border rounded cursor-pointer"
                  />
                  <Input
                    {...register("color")}
                    value={selectedColor}
                    onChange={(e) => handleColorSelect(e.target.value.toUpperCase())}
                    placeholder="#RRGGBB"
                    className="w-24 font-mono"
                  />
                </div>
                {errors.color && (
                  <p className="text-sm text-destructive mt-1">{errors.color.message}</p>
                )}
              </div>

              {/* Preview */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Preview:</p>
              <Badge 
                className="text-white font-medium"
                style={{ backgroundColor: selectedColor }}
              >
                Exemplo de Status
              </Badge>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : status ? "Atualizar" : "Criar Status"}
            </Button>
            {status && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}