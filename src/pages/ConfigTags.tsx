import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { TagList } from "@/components/tags/TagList";
import { useTagsStore } from "@/store/tags.store";
import { useToast } from "@/hooks/use-toast";

export function ConfigTags() {
  const { 
    tags, 
    loading, 
    error, 
    loadTags, 
    createTag, 
    updateTag, 
    deleteTag, 
    clearError 
  } = useTagsStore();
  const { toast } = useToast();

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Erro",
        description: error,
        variant: "destructive",
      });
      clearError();
    }
  }, [error, toast, clearError]);

  const handleCreateTag = async (data: { name: string; color: string }) => {
    try {
      await createTag(data);
      toast({
        title: "Sucesso",
        description: "Tag criada com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao criar tag",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTag = async (id: string, data: { name: string; color: string }) => {
    try {
      await updateTag(id, data);
      toast({
        title: "Sucesso", 
        description: "Tag atualizada com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar tag",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTag = async (id: string) => {
    try {
      await deleteTag(id);
      toast({
        title: "Sucesso",
        description: "Tag excluída com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir tag",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Configurações", href: "/config" },
            { label: "Tags" }
          ]} 
        />
        
        <TagList
          tags={tags}
          onCreateTag={handleCreateTag}
          onUpdateTag={handleUpdateTag}
          onDeleteTag={handleDeleteTag}
          loading={loading}
        />
      </div>
    </Layout>
  );
}