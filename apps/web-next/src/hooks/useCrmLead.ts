import { useState, useEffect } from 'react';
import { CrmLead, crmLeadsRepo } from '@/repositories/crmLeadsRepo.supabase';

export function useCrmLead(leadId?: string) {
  const [lead, setLead] = useState<CrmLead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLead = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await crmLeadsRepo.getById(id);
      setLead(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar oportunidade');
      setLead(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leadId) {
      loadLead(leadId);
    } else {
      setLead(null);
      setError(null);
    }
  }, [leadId]);

  return {
    lead,
    loading,
    error,
    refetch: leadId ? () => loadLead(leadId) : undefined
  };
}