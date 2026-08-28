# R2 ATA Audio Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store new ATA transcription recordings in private Cloudflare R2 through resumable multipart uploads while preserving Supabase Storage access for historical recordings.

**Architecture:** The browser sends 20 MiB slices to Edge Function-signed R2 multipart URLs and reports the ETags for server-side completion. The Edge Function is the authorization boundary and routes R2 or legacy Supabase operations by `storage_provider`; the Railway worker uses that same field for download.

**Tech Stack:** Next.js/React, Vitest, Supabase Postgres and Edge Functions, Cloudflare R2 S3 API, AWS SDK v3 in Railway Node.js.

## Global Constraints

- R2 secrets are server-only: `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
- Keep the bucket private; never create a `NEXT_PUBLIC_` R2 secret.
- Existing rows default to `storage_provider = 'supabase'`; new jobs use `r2`.
- Use 20 MiB uniform parts, max three simultaneous uploads, three attempts per failed part.
- R2 CORS allows production and local app origins, methods `PUT`, `GET`, `HEAD`, header `Content-Type`, and exposes `ETag`.

---

### Task 1: Add the provider field and server configuration

**Files:**
- Create: `supabase/migrations/<timestamp>_add_ata_transcription_storage_provider.sql`
- Modify: `apps/ata-transcription-worker/.env.example`
- Modify: `apps/ata-transcription-worker/README.md`

- [ ] Write migration tests/validation first: column is non-null, defaults to `supabase`, and only permits `supabase`/`r2`.
- [ ] Add the migration with `ALTER TABLE public.omnia_ata_transcription_jobs ADD COLUMN storage_provider text NOT NULL DEFAULT 'supabase' CHECK (storage_provider IN ('supabase', 'r2'));`.
- [ ] Document R2 variables only for Supabase Edge Functions and Railway.
- [ ] Verify with `git diff --check` and the Supabase migration checker.
- [ ] Commit: `feat(atas): add R2 storage provider`.

### Task 2: Build the browser multipart primitive with tests

**Files:**
- Create: `apps/web-next/src/lib/r2MultipartUpload.ts`
- Create: `apps/web-next/src/lib/__tests__/r2MultipartUpload.test.ts`
- Modify: `apps/web-next/src/repositories/ataTranscriptionsRepo.supabase.ts`

- [ ] Write failing tests proving a 45 MiB file produces parts 1–3 at 20 MiB boundaries, retries only a rejected part, preserves ordered ETags, and rejects a missing ETag.
- [ ] Run the focused test and observe the missing-helper failure.
- [ ] Implement `uploadR2Multipart(file, plan, onProgress?)`: `fetch` a signed `PUT` for each `Blob.slice`, use three workers and three attempts, return `{ partNumber, etag }[]`; do not log URLs or credentials.
- [ ] Replace `uploadToSignedUrl` in the ATA repository and complete with upload ID plus ETags; cancel receives the upload ID so it can abort.
- [ ] Run focused repository/panel tests and commit `feat(atas): upload transcription audio to R2 in parts`.

### Task 3: Make the Edge Function own R2 lifecycle

**Files:**
- Create: `supabase/functions/ata-transcriptions/r2.ts`
- Modify: `supabase/functions/ata-transcriptions/index.ts`

- [ ] Write a failing helper/smoke test for creation payload, ETag validation, cancel abort, and no queuing before R2 completion.
- [ ] Implement AWS Signature V4 against `https://<account>.r2.cloudflarestorage.com`, region `auto`, with server-side Create/Complete/Abort Multipart and signed one-hour PUT part URLs.
- [ ] Insert new jobs with `storage_provider = 'r2'`, verify `HeadObject` byte size before queuing, and route cancel/replacement/discard/audio URL by provider.
- [ ] Verify with the local function runtime or authenticated R2 smoke test, then commit `feat(atas): manage R2 transcription uploads`.

### Task 4: Add R2 downloads to the Railway worker

**Files:**
- Create: `apps/ata-transcription-worker/src/r2.ts`
- Create: `apps/ata-transcription-worker/src/__tests__/r2.test.ts`
- Modify: `apps/ata-transcription-worker/src/index.ts`
- Modify: `apps/ata-transcription-worker/package.json`

- [ ] Write failing tests proving an R2 job uses `GetObjectCommand`, while a legacy Supabase job still uses Supabase download; missing R2 env fails at startup.
- [ ] Add `@aws-sdk/client-s3`; create R2 client with endpoint/account credentials and `region: 'auto'`.
- [ ] Select `storage_provider` when claiming jobs and pipe either source to the existing FFmpeg workspace.
- [ ] Run worker tests/type-check and commit `feat(worker): download R2 transcription audio`.

### Task 5: Report progress, configure CORS, deploy and verify

**Files:**
- Modify: `apps/web-next/src/components/atas/AtaTranscriptionPanel.tsx`
- Modify: `apps/web-next/src/components/atas/__tests__/AtaTranscriptionPanel.test.tsx`

- [ ] Write failing panel test for actual multipart byte progress.
- [ ] Surface `onProgress` through repository to panel; render measured percentage.
- [ ] Set private-bucket CORS for `https://omnia.loovus.com.br`, `http://localhost:3000`, actual local origin, `PUT`/`GET`/`HEAD`, `Content-Type`, exposed `ETag`, max age 3600.
- [ ] Run `npm --prefix apps/web-next run type-check`, all web tests, worker type-check/tests and `npm run build`.
- [ ] Apply migration; set the four R2 secrets in Supabase and Railway; deploy Edge Function, Railway worker, then Vercel.
- [ ] Verify a new job is `r2`, its object byte size matches DB, it completes and plays; verify a historical Supabase job still plays.
- [ ] Commit `feat(atas): report R2 upload progress`.
