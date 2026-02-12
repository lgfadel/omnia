'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { RescisaoForm } from '@/components/rescisoes/RescisaoForm';
import { useRescisoesStore } from '@/stores/rescisoes.store';
import type { Rescisao } from '@/repositories/rescisaoRepo.supabase';

export default function EditRescisaoPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { getRescisaoById } = useRescisoesStore();
  const [rescisao, setRescisao] = useState<Rescisao | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      const data = await getRescisaoById(id);
      setRescisao(data);
      setLoading(false);
    };
    load();
  }, [id, getRescisaoById]);

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-3xl">
        <div className="text-center py-12">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <RescisaoForm rescisao={rescisao} mode="edit" />
    </div>
  );
}
