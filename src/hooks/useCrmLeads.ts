import { useState, useEffect } from 'react';
import { crmLeadsRepo } from '@/repositories/crmLeadsRepo.supabase';
import { CrmLeadOption } from '@/data/types';
import { logger } from '../lib/logging';


export function useCrmLeads() {
  const [leads, setLeads] = useState<CrmLeadOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await crmLeadsRepo.getAll();
      
      // Transform to CrmLeadOption format
      const leadOptions: CrmLeadOption[] = data.map(lead => ({
        id: lead.id,
        cliente: lead.cliente,
        status: lead.status
      }));
      
      setLeads(leadOptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar oportunidades');
    } finally {
      setLoading(false);
    }
  };

  const searchLeads = async (searchTerm: string): Promise<CrmLeadOption[]> => {
    try {
      if (!searchTerm.trim()) {
        return leads;
      }
      
      const data = await crmLeadsRepo.searchByCompany(searchTerm);
      
      // Transform to CrmLeadOption format
      return data.map(lead => ({
        id: lead.id,
        cliente: lead.cliente,
        status: lead.status
      }));
    } catch (err) {
      logger.error('Erro ao buscar oportunidades:', err);
      return [];
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  return {
    leads,
    loading,
    error,
    loadLeads,
    searchLeads
  };
}