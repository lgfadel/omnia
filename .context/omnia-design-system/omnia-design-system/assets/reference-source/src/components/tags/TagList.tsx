import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Tag } from "@/repositories/tagsRepo.supabase";
import { TagForm } from "./TagForm";

interface TagListProps {
  tags: Tag[];
  onCreateTag: (data: { name: string; color: string }) => void;
  onUpdateTag: (id: string, data: { name: string; color: string }) => void;
  onDeleteTag: (id: string) => void;
  loading?: boolean;
}

export function TagList({ 
  tags, 
  onCreateTag, 
  onUpdateTag, 
  onDeleteTag, 
  loading 
}: TagListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);

  const handleCreate = (data: { name: string; color: string }) => {
    onCreateTag(data);
    setShowCreateForm(false);
  };

  const handleUpdate = (data: { name: string; color: string }) => {
    if (editingTag) {
      onUpdateTag(editingTag.id, data);
      setEditingTag(null);
    }
  };

  const handleDelete = () => {
    if (deletingTag) {
      onDeleteTag(deletingTag.id);
      setDeletingTag(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gerenciar Tags</h2>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Tag
        </Button>
      </div>

      <div className="grid gap-4">
        {tags.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Nenhuma tag encontrada. Crie sua primeira tag!
              </p>
            </CardContent>
          </Card>
        ) : (
          tags.map(tag => (
            <Card key={tag.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge 
                      style={{ backgroundColor: tag.color, color: 'white' }}
                      className="border-none"
                    >
                      {tag.name}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {tag.color}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingTag(tag)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeletingTag(tag)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Tag Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-lg">
          <TagForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreateForm(false)}
            loading={loading}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={!!editingTag} onOpenChange={() => setEditingTag(null)}>
        <DialogContent className="max-w-lg">
          {editingTag && (
            <TagForm
              tag={editingTag}
              onSubmit={handleUpdate}
              onCancel={() => setEditingTag(null)}
              loading={loading}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingTag} onOpenChange={() => setDeletingTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a tag "{deletingTag?.name}"? 
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeletingTag(null)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}