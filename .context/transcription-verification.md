# Transcription UX verification — 2026-10-02

- `npm run test:run`: 384 tests passed in 55 files.
- `npm run build`: Next.js production compilation, TypeScript and route generation passed.
- Scoped ESLint passed for all changed transcription components and tests; `git diff --check` passed.
- Independent review reproduced the overlapping-poll data-loss case before the fix; the reproduction passed after the load-sequence guard. No remaining blocking findings; independent TypeScript check passed.
- `node .context/transcription-preview/capture.mjs`: 12 desktop/mobile screenshots of empty, processing, review, reviewed and expanded search states; no document overflow, browser errors or external requests. Local synthetic audio decodes; closed review remains searchable with replacements locked.
- `node .context/atas-minuta-preview/capture.mjs`: desktop/mobile preparation, reading, expanded history/documents and editing with expanded search; no document overflow or browser errors.

Behavior regressions cover saving dirty text before preparing the minuta, staying on transcription after save failure, refusing empty closed reviews, recovering audio loading, retaining processing/wake behavior, and preserving edits against stale polls. A browser metadata timeout keeps recording selection from remaining blocked indefinitely; unknown duration still reaches the existing worker validation.

No database migration or worker deployment is required. Production publication follows the previously authorized GitHub main/Vercel workflow; `.context/transcription-previous-deployment.json` records the previous production target.

The two Vite visual harnesses initially shared the default dependency cache. Running them together reproduced `504 (Outdated Optimize Dep)` and a blank preview. Each now uses its own ignored `node_modules/.vite/<harness>` cache; both complete capture runners passed concurrently after isolation. Local fixture pages also use an empty data favicon, removing an unrelated `/favicon.ico` 404 seen by Chrome. These changes affect QA fixtures only.
