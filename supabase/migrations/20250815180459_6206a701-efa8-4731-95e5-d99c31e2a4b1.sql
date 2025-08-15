
-- 1) Limpeza de dados órfãos para permitir criação das FKs com sucesso
BEGIN;

-- Se houver atas com secretary inexistente, definir como NULL
UPDATE public.omnia_atas a
SET secretary_id = NULL
WHERE secretary_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.omnia_users u WHERE u.id = a.secretary_id
  );

-- Remover comentários sem ATA
DELETE FROM public.omnia_comments c
WHERE NOT EXISTS (
  SELECT 1 FROM public.omnia_atas a WHERE a.id = c.ata_id
);

-- Remover comentários com autor inexistente
DELETE FROM public.omnia_comments c
WHERE NOT EXISTS (
  SELECT 1 FROM public.omnia_users u WHERE u.id = c.author_id
);

-- Remover anexos com ata inexistente
DELETE FROM public.omnia_attachments att
WHERE att.ata_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.omnia_atas a WHERE a.id = att.ata_id
  );

-- Remover anexos com comentário inexistente
DELETE FROM public.omnia_attachments att
WHERE att.comment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.omnia_comments c WHERE c.id = att.comment_id
  );

-- Remover vínculos de tags com ata ou tag inexistente
DELETE FROM public.omnia_ata_tags t
WHERE NOT EXISTS (
  SELECT 1 FROM public.omnia_atas a WHERE a.id = t.ata_id
)
OR NOT EXISTS (
  SELECT 1 FROM public.omnia_tags g WHERE g.id = t.tag_id
);

COMMIT;

-- 2) Criação das chaves estrangeiras exatamente com os nomes esperados

-- omnia_atas.secretary_id -> omnia_users.id
ALTER TABLE public.omnia_atas
  ADD CONSTRAINT omnia_atas_secretary_id_fkey
  FOREIGN KEY (secretary_id)
  REFERENCES public.omnia_users(id)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

-- omnia_atas.status_id -> omnia_statuses.id
ALTER TABLE public.omnia_atas
  ADD CONSTRAINT omnia_atas_status_id_fkey
  FOREIGN KEY (status_id)
  REFERENCES public.omnia_statuses(id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- omnia_comments.ata_id -> omnia_atas.id
ALTER TABLE public.omnia_comments
  ADD CONSTRAINT omnia_comments_ata_id_fkey
  FOREIGN KEY (ata_id)
  REFERENCES public.omnia_atas(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

-- omnia_comments.author_id -> omnia_users.id
ALTER TABLE public.omnia_comments
  ADD CONSTRAINT omnia_comments_author_id_fkey
  FOREIGN KEY (author_id)
  REFERENCES public.omnia_users(id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- omnia_attachments.ata_id -> omnia_atas.id
ALTER TABLE public.omnia_attachments
  ADD CONSTRAINT omnia_attachments_ata_id_fkey
  FOREIGN KEY (ata_id)
  REFERENCES public.omnia_atas(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

-- omnia_attachments.comment_id -> omnia_comments.id
ALTER TABLE public.omnia_attachments
  ADD CONSTRAINT omnia_attachments_comment_id_fkey
  FOREIGN KEY (comment_id)
  REFERENCES public.omnia_comments(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

-- omnia_ata_tags.ata_id -> omnia_atas.id
ALTER TABLE public.omnia_ata_tags
  ADD CONSTRAINT omnia_ata_tags_ata_id_fkey
  FOREIGN KEY (ata_id)
  REFERENCES public.omnia_atas(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

-- omnia_ata_tags.tag_id -> omnia_tags.id
ALTER TABLE public.omnia_ata_tags
  ADD CONSTRAINT omnia_ata_tags_tag_id_fkey
  FOREIGN KEY (tag_id)
  REFERENCES public.omnia_tags(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;
