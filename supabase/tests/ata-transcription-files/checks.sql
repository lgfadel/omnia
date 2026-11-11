\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.omnia_users VALUES
 ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', ARRAY['USUARIO']),
 ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', ARRAY['USUARIO']),
 ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', ARRAY['SECRETARIO']);
INSERT INTO public.omnia_atas VALUES
 ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002');
INSERT INTO public.omnia_ata_transcription_jobs
 (id, ata_id, created_by, storage_path, original_filename, mime_type, size_bytes, storage_provider, status)
 VALUES
 ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'job/first.mp3', 'first.mp3', 'audio/mpeg', 500, 'r2', 'processing'),
 ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'other/first.mp3', 'first.mp3', 'audio/mpeg', 500, 'r2', 'processing');
INSERT INTO public.omnia_ata_transcription_jobs
 (id, ata_id, created_by, storage_path, original_filename, mime_type, size_bytes, storage_provider, status, is_current)
 VALUES ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'legacy-only.mp3', 'legacy.mp3', 'audio/mpeg', 500, 'r2', 'completed', false);
INSERT INTO public.omnia_ata_transcription_files (id, job_id, position, original_filename, mime_type, size_bytes, storage_path, storage_provider)
 VALUES
 ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 1, 'first.mp3', 'audio/mpeg', 500, 'job/first.mp3', 'r2'),
 ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 2, 'second.mp3', 'audio/mpeg', 600, 'job/second.mp3', 'r2'),
 ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 1, 'first.mp3', 'audio/mpeg', 500, 'other/first.mp3', 'r2');

DO $$ BEGIN
 IF has_table_privilege('authenticated', 'public.omnia_ata_transcription_files', 'INSERT,UPDATE,DELETE') OR
    has_table_privilege('anon', 'public.omnia_ata_transcription_files', 'SELECT') OR
    has_function_privilege('authenticated', 'public.omnia_commit_ata_transcription_file(uuid,text,bigint,text)', 'EXECUTE') OR
    has_function_privilege('anon', 'public.omnia_commit_ata_transcription_file(uuid,text,bigint,text)', 'EXECUTE') THEN
   RAISE EXCEPTION 'Unexpected public mutation/read/RPC grants';
 END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.omnia_ata_transcription_files) <> 2 THEN RAISE EXCEPTION 'Responsible should see only their two source files'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.omnia_ata_transcription_files) <> 3 THEN RAISE EXCEPTION 'Secretary should see all parent-visible files'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000099', true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.omnia_ata_transcription_files) THEN RAISE EXCEPTION 'Unknown profile should not see files'; END IF;
END $$;
RESET ROLE;

-- Constraint checks execute the actual migration, not text matching.
DO $$ BEGIN
 BEGIN
   INSERT INTO public.omnia_ata_transcription_files (job_id, position, original_filename, mime_type, size_bytes, storage_path, storage_provider)
   VALUES ('40000000-0000-0000-0000-000000000001', 4, 'fourth.mp3', 'audio/mpeg', 1, 'fourth', 'r2');
   RAISE EXCEPTION 'Fourth position accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
   INSERT INTO public.omnia_ata_transcription_files (job_id, position, original_filename, mime_type, size_bytes, storage_path, storage_provider)
   VALUES ('40000000-0000-0000-0000-000000000001', 2, 'duplicate.mp3', 'audio/mpeg', 1, 'duplicate', 'r2');
   RAISE EXCEPTION 'Duplicate position accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
   UPDATE public.omnia_ata_transcription_files SET size_bytes = 0 WHERE id = '50000000-0000-0000-0000-000000000001';
   RAISE EXCEPTION 'Zero size accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
   UPDATE public.omnia_ata_transcription_files SET duration_seconds = 0 WHERE id = '50000000-0000-0000-0000-000000000001';
   RAISE EXCEPTION 'Zero duration accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
   UPDATE public.omnia_ata_transcription_files SET storage_provider = 'unknown' WHERE id = '50000000-0000-0000-0000-000000000001';
   RAISE EXCEPTION 'Unknown provider accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

SET LOCAL ROLE service_role;
SELECT public.omnia_commit_ata_transcription_file('50000000-0000-0000-0000-000000000002', 'job/second.compact.m4a', 200, 'audio/mp4');
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.omnia_ata_transcription_jobs WHERE id = '40000000-0000-0000-0000-000000000001' AND storage_path = 'job/first.mp3' AND size_bytes = 500) THEN
   RAISE EXCEPTION 'Second source overwrote compatibility pointer';
 END IF;
END $$;
SELECT public.omnia_commit_ata_transcription_file('50000000-0000-0000-0000-000000000001', 'job/first.compact.m4a', 150, 'audio/mp4');
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.omnia_ata_transcription_jobs WHERE id = '40000000-0000-0000-0000-000000000001' AND storage_path = 'job/first.compact.m4a' AND size_bytes = 150 AND mime_type = 'audio/mp4') OR
    NOT EXISTS (SELECT 1 FROM public.omnia_ata_transcription_files WHERE id = '50000000-0000-0000-0000-000000000001' AND storage_path = 'job/first.compact.m4a' AND size_bytes = 150 AND mime_type = 'audio/mp4') THEN
   RAISE EXCEPTION 'Compaction metadata was not committed together';
 END IF;
 -- Parent check constraint failure must roll back the source update too.
 BEGIN
   PERFORM public.omnia_commit_ata_transcription_file('50000000-0000-0000-0000-000000000001', 'legacy-only.mp3', 1, 'audio/mp4');
   RAISE EXCEPTION 'Duplicate parent pointer accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 IF NOT EXISTS (SELECT 1 FROM public.omnia_ata_transcription_files WHERE id = '50000000-0000-0000-0000-000000000001' AND storage_path = 'job/first.compact.m4a') THEN
   RAISE EXCEPTION 'Failed parent commit left source modified';
 END IF;
END $$;
UPDATE public.omnia_ata_transcription_jobs SET is_current = false WHERE id = '40000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 BEGIN
   PERFORM public.omnia_commit_ata_transcription_file('50000000-0000-0000-0000-000000000001', 'stale.m4a', 100, 'audio/mp4');
   RAISE EXCEPTION 'Stale worker committed';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
END $$;
UPDATE public.omnia_ata_transcription_jobs SET is_current = true, status = 'completed' WHERE id = '40000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 BEGIN
   PERFORM public.omnia_commit_ata_transcription_file('50000000-0000-0000-0000-000000000001', 'completed.m4a', 100, 'audio/mp4');
   RAISE EXCEPTION 'Completed worker committed';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
END $$;
DELETE FROM public.omnia_ata_transcription_jobs WHERE id = '40000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.omnia_ata_transcription_files WHERE job_id = '40000000-0000-0000-0000-000000000001') THEN
   RAISE EXCEPTION 'Job deletion did not cascade';
 END IF;
END $$;
RESET ROLE;
ROLLBACK;
