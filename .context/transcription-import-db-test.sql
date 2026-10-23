\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.omnia_users (id, auth_user_id, roles) VALUES ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', ARRAY['ADMIN']);
INSERT INTO public.omnia_atas (id, responsible_id) VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnia_ata_transcription_jobs, public.omnia_ata_transcriptions TO service_role;
GRANT SELECT, UPDATE ON public.omnia_atas TO service_role;

-- Two inactive imports, exactly as prepared by the server.
INSERT INTO public.omnia_ata_transcription_jobs
(id, ata_id, created_by, original_filename, mime_type, size_bytes, status, source_type, storage_path, storage_provider, model, is_current)
VALUES
('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'zoom.vtt', 'text/vtt', 70, 'completed', 'text_import', null, null, null, false),
('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'ata.txt', 'text/plain', 70, 'completed', 'text_import', null, null, null, false);

SET LOCAL ROLE service_role;
SELECT public.omnia_activate_ata_transcription('33333333-3333-4333-8333-333333333333', null, 'Maria: Contas aprovadas.');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT raw_text = 'Maria: Contas aprovadas.' AND NOT is_reviewed FROM public.omnia_ata_transcriptions WHERE job_id = '33333333-3333-4333-8333-333333333333'), 'imported text must be persisted for review';
  ASSERT (SELECT count(*) = 1 FROM public.omnia_ata_transcription_jobs WHERE is_current), 'exactly one current source';
  BEGIN
    PERFORM public.omnia_activate_ata_transcription('44444444-4444-4444-8444-444444444444', null, 'stale');
    RAISE EXCEPTION 'stale source was accepted';
  EXCEPTION WHEN SQLSTATE '40001' THEN NULL; END;
  ASSERT NOT EXISTS (SELECT FROM public.omnia_ata_transcriptions WHERE job_id = '44444444-4444-4444-8444-444444444444'), 'stale import must not leave text behind';
  BEGIN
    PERFORM public.omnia_activate_ata_transcription('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', ' ');
    RAISE EXCEPTION 'empty import was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  ASSERT (SELECT is_current FROM public.omnia_ata_transcription_jobs WHERE id = '33333333-3333-4333-8333-333333333333'), 'failed replacement must preserve current';
END $$;

-- Replacement text becomes the only current source; previous text stays historical.
SET LOCAL ROLE service_role;
SELECT public.omnia_activate_ata_transcription('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', 'João: Novo texto.');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT count(*) = 1 FROM public.omnia_ata_transcription_jobs WHERE is_current);
  ASSERT (SELECT count(*) = 2 FROM public.omnia_ata_transcriptions), 'history must be preserved';
  ASSERT NOT has_function_privilege('authenticated', 'public.omnia_activate_ata_transcription(uuid,uuid,text)', 'EXECUTE'), 'authenticated must not bypass server authorization';
  ASSERT NOT has_function_privilege('anon', 'public.omnia_activate_ata_transcription(uuid,uuid,text)', 'EXECUTE');
END $$;

INSERT INTO public.omnia_ata_transcription_jobs
(id, ata_id, created_by, original_filename, mime_type, size_bytes, storage_path, storage_provider, is_current)
VALUES ('55555555-5555-4555-8555-555555555555', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'ata.mp3', 'audio/mpeg', 500, 'test/ata.mp3', 'r2', false);
SELECT public.omnia_activate_ata_transcription('55555555-5555-4555-8555-555555555555', '44444444-4444-4444-8444-444444444444', null);
DO $$ BEGIN
  ASSERT (SELECT is_current AND source_type = 'audio' FROM public.omnia_ata_transcription_jobs WHERE id = '55555555-5555-4555-8555-555555555555'), 'switching from import to audio must work';
  UPDATE public.omnia_ata_transcription_jobs SET is_current = false WHERE id = '33333333-3333-4333-8333-333333333333';
  BEGIN
    PERFORM public.omnia_activate_ata_transcription('33333333-3333-4333-8333-333333333333', '55555555-5555-4555-8555-555555555555', 'overwrite in progress');
    RAISE EXCEPTION 'active audio was replaced';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
  ASSERT (SELECT is_current FROM public.omnia_ata_transcription_jobs WHERE id = '55555555-5555-4555-8555-555555555555');
END $$;
-- An import prepared during an audio upload must never become its predecessor.
INSERT INTO public.omnia_ata_transcription_jobs
(id, ata_id, created_by, original_filename, mime_type, size_bytes, status, source_type, storage_path, storage_provider, model, is_current)
VALUES ('66666666-6666-4666-8666-666666666666', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'candidate.txt', 'text/plain', 20, 'completed', 'text_import', null, null, null, false);
SELECT public.omnia_cancel_ata_transcription_upload('55555555-5555-4555-8555-555555555555');
DO $$ BEGIN
  ASSERT (SELECT is_current FROM public.omnia_ata_transcription_jobs WHERE id = '44444444-4444-4444-8444-444444444444'), 'cancel must restore the exact predecessor';
  ASSERT NOT (SELECT is_current FROM public.omnia_ata_transcription_jobs WHERE id = '66666666-6666-4666-8666-666666666666'), 'a prepared import without text must never become current';
  ASSERT NOT has_function_privilege('authenticated', 'public.omnia_cancel_ata_transcription_upload(uuid)', 'EXECUTE');
END $$;
UPDATE public.omnia_ata_transcription_jobs SET is_current = false;
INSERT INTO public.omnia_ata_transcription_jobs
(id, ata_id, created_by, original_filename, mime_type, size_bytes, storage_path, storage_provider, is_current)
VALUES ('77777777-7777-4777-8777-777777777777', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'first.mp3', 'audio/mpeg', 500, 'test/first.mp3', 'r2', false);
SELECT public.omnia_activate_ata_transcription('77777777-7777-4777-8777-777777777777', null, null);
SELECT public.omnia_cancel_ata_transcription_upload('77777777-7777-4777-8777-777777777777');
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT FROM public.omnia_ata_transcription_jobs WHERE is_current), 'cancel without predecessor must not revive discarded history';
END $$;
-- Existing RLS must continue to protect imported transcript content.
GRANT SELECT ON public.omnia_users, public.omnia_atas TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;
SELECT set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT FROM public.omnia_ata_transcriptions), 'outsiders must not read imported speech';
  ASSERT NOT EXISTS (SELECT FROM public.omnia_ata_transcription_jobs), 'outsiders must not read source metadata';
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'transcription import database checks passed' AS result;
