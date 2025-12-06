import { useState, useEffect } from "react";
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
import { generateUniqueTagColor } from "@/utils/tagColors";
import { useTagsStore } from "@/store/tags.store";
import { logger } from '../../lib/logging';


const tagSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  color: z.string().optional() // Cor agora é opcional pois será gerada automaticamente
});

type TagFormData = z.infer<typeof tagSchema>;

interface TagFormProps {
  tag?: Tag;
  onSubmit: (data: TagFormData & { color: string }) => void; // Garantir que cor sempre seja enviada
  onCancel: () => void;
  loading?: boolean;
}

export function TagForm({ tag, onSubmit, onCancel, loading }: TagFormProps) {
  const [generatedColor, setGeneratedColor] = useState(tag?.color || '');
  const { tags } = useTagsStore();

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: tag?.name || "",
    }
  });

  // Gerar cor automática apenas para novas tags (não para edição)
  useEffect(() => {
    if (!tag && !generatedColor) {
      logger.debug('🎨 TagForm: Generating automatic color for new tag...');
      const usedColors = tags.map(t => t.color);
      const newColor = generateUniqueTagColor(usedColors);
      logger.debug('🎨 TagForm: Generated color:', newColor);
      setGeneratedColor(newColor);
    }
  }, [tag, generatedColor, tags]);

  const onFormSubmit = (data: TagFormData) => {
    logger.debug('📝 TagForm: Submitting with data:', { data, color: generatedColor });
    onSubmit({
      ...data,
      color: generatedColor
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

          {/* Preview da cor automática */}
          {generatedColor && (
            <div className="space-y-2">
              <Label>Cor da Tag</Label>
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                <Badge 
                  style={{ backgroundColor: generatedColor, color: 'white' }}
                  className="border-none"
                >
                  {tag ? 'Cor atual' : 'Cor automática'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {tag ? 'A cor não pode ser alterada' : 'Cor gerada automaticamente'}
                </span>
              </div>
            </div>
          )}

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