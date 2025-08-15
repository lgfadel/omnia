-- Add missing foreign key constraints to enable PostgREST relationships for nested selects
-- Clean up potential orphans (set to NULL where appropriate) to avoid FK failures

-- Ensure secretary_id references a valid user or is NULL
UPDATE public.omnia_atas a
SET secretary_id = NULL
WHERE secretary_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.omnia_users u WHERE u.id = a.secretary_id
  );

-- Ensure comments reference existing atas and authors
DELETE FROM public.omnia_comments c
WHERE NOT EXISTS (
  SELECT 1 FROM public.omnia_atas a WHERE a.id = c.ata_id
);

UPDATE public.omnia_comments c
SET author_id = (SELECT id FROM public.omnia_users u ORDER BY u.created_at ASC LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.omnia_users u WHERE u.id = c.author_id
);

-- Ensure attachments reference existing atas; detach from missing comments
DELETE FROM public.omnia_attachments att
WHERE ata_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.omnia_atas a WHERE a.id = att.ata_id
);

UPDATE public.omnia_attachments att
SET comment_id = NULL
WHERE comment_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.omnia_comments c WHERE c.id = att.comment_id
);

-- Ensure join table references exist
DELETE FROM public.omnia_ata_tags at
WHERE NOT EXISTS (SELECT 1 FROM public.omnia_atas a WHERE a.id = at.ata_id)
   OR NOT EXISTS (SELECT 1 FROM public.omnia_tags t WHERE t.id = at.tag_id);

-- Add Foreign Keys (use IF NOT EXISTS pattern via exception handling)
DO $$ BEGIN
  ALTER TABLE public.omnia_atas
    ADD CONSTRAINT fk_atas_secretary
    FOREIGN KEY (secretary_id) REFERENCES public.omnia_users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.omnia_comments
    ADD CONSTRAINT fk_comments_ata
    FOREIGN KEY (ata_id) REFERENCES public.omnia_atas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.omnia_comments
    ADD CONSTRAINT fk_comments_author
    FOREIGN KEY (author_id) REFERENCES public.omnia_users(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.omnia_attachments
    ADD CONSTRAINT fk_attachments_ata
    FOREIGN KEY (ata_id) REFERENCES public.omnia_atas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.omnia_attachments
    ADD CONSTRAINT fk_attachments_comment
    FOREIGN KEY (comment_id) REFERENCES public.omnia_comments(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.omnia_ata_tags
    ADD CONSTRAINT fk_ata_tags_ata
    FOREIGN KEY (ata_id) REFERENCES public.omnia_atas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.omnia_ata_tags
    ADD CONSTRAINT fk_ata_tags_tag
    FOREIGN KEY (tag_id) REFERENCES public.omnia_tags(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
