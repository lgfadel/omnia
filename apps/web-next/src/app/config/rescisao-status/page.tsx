'use client';

import { useEffect, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RescisaoStatusList } from '@/components/rescisoes/RescisaoStatusList';
import { RescisaoStatusForm } from '@/components/rescisoes/RescisaoStatusForm';
import { useRescisaoStatusStore } from '@/store/rescisaoStatus.store';
import { useToast } from '@/hooks/use-toast';
import type { RescisaoStatus } from '@/repositories/rescisaoStatusRepo.supabase';

export default function ConfigRescisaoStatusPage() {
  const { 
    statuses, 
    loading, 
    loadStatuses, 
    createStatus, 
    updateStatus, 
    deleteStatus, 
    reorderStatuses 
  } = useRescisaoStatusStore();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<RescisaoStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const handleCreate = () => {
    setEditingStatus(null);
    setFormOpen(true);
  };

  const handleEdit = (status: RescisaoStatus) => {
    setEditingStatus(status);
    setFormOpen(true);
  };

  const handleSubmit = async (data: Omit<RescisaoStatus, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setSubmitting(true);
      if (editingStatus) {
        await updateStatus(editingStatus.id, data);
        toast({ title: 'Status atualizado com sucesso!' });
      } else {
        await createStatus(data);
        toast({ title: 'Status criado com sucesso!' });
      }
      setFormOpen(false);
      setEditingStatus(null);
    } catch (error) {
      toast({ 
        title: 'Erro', 
        description: error instanceof Error ? error.message : 'Ocorreu um erro',
        variant: 'destructive' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStatus(id);
      toast({ title: 'Status excluído com sucesso!' });
    } catch (error) {
      toast({ 
        title: 'Erro', 
        description: error instanceof Error ? error.message : 'Ocorreu um erro',
        variant: 'destructive' 
      });
    }
  };

  const handleReorder = async (reorderedStatuses: RescisaoStatus[]) => {
    try {
      await reorderStatuses(reorderedStatuses);
    } catch (error) {
      toast({ 
        title: 'Erro', 
        description: 'Erro ao reordenar status',
        variant: 'destructive' 
      });
    }
  };

  if (loading && statuses.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-6 max-w-2xl">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Status de Rescisão</CardTitle>
              <CardDescription>
                Gerencie os status disponíveis para o fluxo de rescisões.
                Arraste para reordenar.
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Status
            </Button>
          </CardHeader>
          <CardContent>
            {statuses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum status cadastrado ainda.
              </div>
            ) : (
              <RescisaoStatusList
                statuses={statuses}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReorder={handleReorder}
              />
            )}
          </CardContent>
        </Card>

        <RescisaoStatusForm
          open={formOpen}
          onOpenChange={setFormOpen}
          status={editingStatus}
          onSubmit={handleSubmit}
          isLoading={submitting}
        />
      </div>
    </Layout>
  );
}
