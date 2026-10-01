-- Bind the automatic ATA review stage to the existing Revisão/Correções status.
-- The earlier workflow migration created a separate "Revisão" row because it
-- did not recognize the existing status name. Move any ATAs using that row,
-- then remove the duplicate while preserving the existing status and its order.
DO $$
DECLARE
  canonical_status_id uuid;
  generated_review_status_id uuid;
  next_order integer;
BEGIN
  SELECT id INTO canonical_status_id
  FROM public.omnia_statuses
  WHERE lower(btrim(name)) IN ('revisão/correções', 'revisao/correcoes')
    AND workflow_key IS NULL
  ORDER BY order_position, created_at, id
  LIMIT 1;

  SELECT id INTO generated_review_status_id
  FROM public.omnia_statuses
  WHERE workflow_key = 'review'
  LIMIT 1;

  IF canonical_status_id IS NULL THEN
    IF generated_review_status_id IS NOT NULL THEN
      -- Keep the mapped row if this database had no prior review status.
      canonical_status_id := generated_review_status_id;
      UPDATE public.omnia_statuses
      SET name = 'Revisão/Correções'
      WHERE id = canonical_status_id;
    ELSE
      SELECT COALESCE(MAX(order_position), 0) + 1 INTO next_order
      FROM public.omnia_statuses;

      INSERT INTO public.omnia_statuses (name, color, order_position, is_default)
      VALUES ('Revisão/Correções', '#FBBF24', next_order, false)
      RETURNING id INTO canonical_status_id;
    END IF;
  END IF;

  IF generated_review_status_id IS NOT NULL
    AND generated_review_status_id <> canonical_status_id THEN
    UPDATE public.omnia_atas
    SET status_id = canonical_status_id
    WHERE status_id = generated_review_status_id;

    DELETE FROM public.omnia_statuses
    WHERE id = generated_review_status_id;
  END IF;

  UPDATE public.omnia_statuses
  SET workflow_key = 'review', is_default = false
  WHERE id = canonical_status_id;
END;
$$;
