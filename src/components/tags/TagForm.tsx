import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette } from "lucide-react";
import { Tag } from "@/repositories/tagsRepo.supabase";

const tagSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  color: z.string().min(1, "Cor é obrigatória")
});

type TagFormData = z.infer<typeof tagSchema>;

interface TagFormProps {
  tag?: Tag;
  onSubmit: (data: TagFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange  
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280'  // gray
];

export function TagForm({ tag, onSubmit, onCancel, loading }: TagFormProps) {
  const [selectedColor, setSelectedColor] = useState(tag?.color || '#6366f1');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: tag?.name || "",
      color: tag?.color || '#6366f1'
    }
  });

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setValue('color', color);
  };

  const onFormSubmit = (data: TagFormData) => {
    onSubmit({
      ...data,
      color: selectedColor
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{tag ? 'Editar Tag' : 'Nova Tag'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input 
              id="name" 
              {...register("name")} 
              placeholder="Ex: Urgente" 
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Cor *</Label>
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-4 h-4" />
              <Badge 
                style={{ backgroundColor: selectedColor, color: 'white' }}
                className="border-none"
              >
                Prévia
              </Badge>
            </div>
            
            <div className="grid grid-cols-5 gap-2">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded border-2 transition-all ${
                    selectedColor === color 
                      ? 'border-foreground scale-110' 
                      : 'border-muted hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorSelect(color)}
                />
              ))}
            </div>
            
            <Input
              type="color"
              value={selectedColor}
              onChange={(e) => handleColorSelect(e.target.value)}
              className="w-full h-10"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : tag ? "Atualizar" : "Criar Tag"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}