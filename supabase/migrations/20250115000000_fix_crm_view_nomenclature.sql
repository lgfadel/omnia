-- Corrigir nomenclatura da view crm_lead_comment_counts para seguir o padrão omnia_
-- Todas as outras tabelas e objetos seguem o padrão omnia_*

-- Remover a view antiga se existir
DROP VIEW IF EXISTS crm_lead_comment_counts;

-- Criar a view com nomenclatura correta
CREATE OR REPLACE VIEW omnia_crm_lead_comment_counts AS
SELECT 
  lead_id,
  COUNT(*) as comment_count
FROM omnia_crm_comments
GROUP BY lead_id;

-- Atualizar permissões
GRANT SELECT ON omnia_crm_lead_comment_counts TO authenticated;

-- Comentário sobre a view
COMMENT ON VIEW omnia_crm_lead_comment_counts IS 'View para contar comentários por lead do CRM';