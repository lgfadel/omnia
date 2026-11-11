-- Minimal empty Postgres fixture. Run only in a disposable database.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE public.omnia_users (id uuid PRIMARY KEY, auth_user_id uuid, roles text[]);
CREATE TABLE public.omnia_atas (id uuid PRIMARY KEY, responsible_id uuid);
GRANT SELECT ON public.omnia_users, public.omnia_atas TO authenticated;
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
\ir ../../migrations/20260819143618_create_ata_audio_transcriptions.sql
\ir ../../migrations/20260828170000_add_ata_transcription_storage_provider.sql
\ir ../../migrations/20261023155020_add_ata_transcription_import.sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
\ir ../../migrations/20261111172136_ata_transcription_multiple_audio.sql
