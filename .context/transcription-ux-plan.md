# Transcription UX refactor — 2026-10-02

Goal: bring transcription preparation, progress and review into the same calm document workspace as the minuta.

Architecture: keep the existing repository, R2 upload, worker wake/polling and review persistence contracts. AtaTranscriptionPanel owns state and actions; extract upload and review views. Editor remains shared with minuta and keeps literal search, replacements and undo. No database migration or worker changes.

Design:
- Header and three-stage workflow: recording, transcription, review. Show active/completed stages from actual job/review state.
- Upload: drag/select recording, accepted formats, existing 6-hour/1GiB limits and explicit immediate-upload behavior; separate optional convocação with parsed metadata and removal. No artificial progress percentages added.
- Processing: one restrained progress area, filename and existing chunk-stage progress; preserve interruption/unavailable alerts and retries.
- Review: spacious text area on the left; original recording, review/save/minuta actions and secondary replacement/discard actions in a narrower sidebar. Mobile stacks naturally without horizontal overflow.
- Unsaved changes are explicit. Preparing the minuta saves dirty text first and does not navigate if saving fails. Empty text cannot be marked reviewed. Reading audio errors allows retrying without blocking text review.
- Locate/replace uses disclosure; readable text, searchable closed reviews with mutations blocked, semantic tokens and reduced-motion handling.

Tasks:
- [x] Upload component with accessible drag/drop, optional PDF selection, multi-file/disabled guards and meaningful tests.
- [x] Editor/status refactor with disclosure and locked-review search tests; preserve minuta compatibility.
- [x] Panel/review layout and state integration, saving/navigation/empty-text/audio retry tests; preserve existing polling/worker/discard/replacement behavior.
- [x] Focused/full tests, lint, TypeScript and production build; isolated actual-component screenshots at desktop/mobile in empty, processing, review and reviewed states; independent code review.

Generated artifacts live in `.context/`. The previous production publication remains the deployment context; release only after verification.

Implementation decisions: replacement/discard remain directly discoverable below a separator with subdued buttons. A monotonic load sequence ignores stale polls, preserving corrections after processing finishes. Browser audio metadata has a 10-second fallback to the existing server-side validation, so recording selection cannot remain blocked indefinitely. Both cases have regression tests that failed before their fixes.
