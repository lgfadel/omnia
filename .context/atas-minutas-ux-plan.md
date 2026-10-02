# Atas/minutas UX implementation plan — 2026-10-02

Goal: make draft preparation and review easy to navigate, accept support PDFs above 25 MB, and apply instructions on the first draft.

Architecture: retain the existing Next.js/React components, semantic design tokens, signed direct Supabase uploads, streaming Responses API, and version history. Keep the detail page tabs; prepare the draft in two clearly ordered sections, then show a wide document and a narrower revision sidebar. Initial implementation ran without shared data changes; the user subsequently authorized production publication.

## Constraints and design
- PDFs: 45 MiB per file and 45 MiB combined per ata, below the provider's 50 MB aggregate limit. Private bucket migration must match. Audio already supports 1 GiB and is unchanged.
- Initial optional instructions reuse `streamTurn(ataId, instruction, onEvent)`; absence of an existing draft means generation, including when an instruction is supplied. Existing instructed turns remain refinements. Initial instructions and their response are saved in message history; version origin stays `generation`.
- Preparation: numbered supporting-document and initial-instruction sections, visible optional labels, descriptive examples, a single generation action with prerequisites and upload state.
- Review: document-first two-column workspace (one column on small screens), labeled export/edit actions, refinement chat and collapsed supporting documents/history. Keep recover/save/restore capabilities.
- Use existing font and semantic color tokens, restrained borders and generous whitespace; avoid introducing unrelated brand or font changes.

## Tasks
- [x] Upload: add pure per-file/aggregate validations and meaningful boundary tests; enforce aggregate checks before uploads and generation; create bucket-limit migration with CLI; update document UX with size/budget and accessible file input, retain signed upload.
- [x] Initial instructions: add failing prompt/service tests; support instructions in initial generation without refinement prerequisites; save messages and preserve generation version origin, correct repo comment.
- [x] UI: add failing panel behavior tests for initial instruction submission, no-transcription prerequisites, error retention and failed first-generation retry; redesign panel and supporting-document UI; polish detail-page navigation/responsiveness and transcription header to match.
- [x] Verification: run focused tests, entire suite, TypeScript and production build; inspect rendered desktop/mobile preparation and review states; independent review and fix any material regressions.

Validation commands: `npm --prefix apps/web-next run test:run`, `npm run type-check`, `npm run build`, focused Vitest files in `src/components/atas/__tests__`, `src/lib/__tests__`, and `src/server/__tests__`. Generated screenshots/notes live in `.context/`.

## Final verification
- 361 tests passed across 54 files; TypeScript and production build passed. Changed-file ESLint and diff checks passed.
- Actual React components rendered with isolated fixtures at 1440 px and 390 px. Preparation/review and expanded document/history states have no horizontal overflow or browser errors. Captures: `.context/atas-minuta-preview/`.
- Initial instructions survive failed empty/partial regeneration and later refinement; explicitly clearing the field omits recovered instructions. Failed partial drafts offer Continue.
- Bucket migration `supabase/migrations/20261002204240_increase_ata_minuta_document_upload_limit.sql` is applied in production. An actual signed upload of 47,185,920 bytes passed, verifying both the bucket and global Storage limits; the temporary PDF was removed.
- Concurrent confirmations can exceed the stored aggregate budget; generation revalidates the complete document set and prevents an oversized provider request.

## Production release — 2026-10-02
User authorized production publication. Revalidated production build and all 361 tests. Vercel project `omnia` is connected to `lgfadel/omnia` main and production domain `omnia.loovus.com.br`. Applied the specific private bucket-limit migration in Supabase project `elmxwvimjxcswjbrzznq`; migration filename matches its recorded production version.
Production smoke test passed for the exact 45 MiB signed upload; temporary PDF removed. Repository lint passed with zero errors (existing warnings only).
