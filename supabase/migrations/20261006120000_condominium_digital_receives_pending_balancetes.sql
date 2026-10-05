-- Condomínio que passa de balancete físico para digital: os balancetes que ainda
-- aguardavam o físico (received_at IS NULL) passam a constar como entregues em digital.
--
-- A data de recebimento segue a regra da importação CSV para condomínios digitais
-- (data de criação do digital, no calendário de Brasília). Sem digital_prepared_at,
-- usa a data de hoje em Brasília. Só preenche received_at vazio; nunca sobrescreve.
--
-- Fica no banco (e não na tela) para valer qualquer que seja a origem da alteração.
CREATE OR REPLACE FUNCTION omnia_condominium_digital_receive_pending_balancetes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE omnia_balancetes
     SET received_at = COALESCE(
           (digital_prepared_at AT TIME ZONE 'America/Sao_Paulo')::date,
           (now() AT TIME ZONE 'America/Sao_Paulo')::date
         )
   WHERE condominium_id = NEW.id
     AND received_at IS NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER omnia_condominium_digital_receive_pending_balancetes
  AFTER UPDATE OF balancete_digital ON omnia_condominiums
  FOR EACH ROW
  WHEN (NEW.balancete_digital IS TRUE AND OLD.balancete_digital IS DISTINCT FROM TRUE)
  EXECUTE FUNCTION omnia_condominium_digital_receive_pending_balancetes();

COMMENT ON FUNCTION omnia_condominium_digital_receive_pending_balancetes() IS
  'Ao marcar o condomínio como digital, dá baixa nos balancetes que aguardavam o físico (received_at vazio)';
