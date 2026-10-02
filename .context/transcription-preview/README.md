# Local transcription visual QA

This harness imports the actual `AtaTranscriptionPanel`, its child components, the app's global CSS and Tailwind configuration. Only the transcription repository and `readConvocacao` are replaced with deterministic local fixtures; no account credentials or live data are loaded. The runner aborts and records external requests.

Select `?state=empty`, `processing`, `review` or `reviewed`. Completed fixtures include six timestamped paragraphs, `AGO-jardim.m4a`, and a valid one-second PCM WAV encoded as a local data URL. Processing has a fresh heartbeat, four chunks and one completed chunk. Fixture review saves, retry, wake, upload and discard follow the production repository contracts.

Run from the repository root: `node .context/transcription-preview/capture.mjs`. The runner starts Vite at `127.0.0.1:4180`, captures 1440 px desktop and 390 px mobile images for all four states and expanded locate/replace in both review states, and writes `layout-report.json`. It asserts no horizontal overflow, browser errors, external requests or audio decoding errors, and checks that closed reviews still permit search while preventing replacements.

The wrapper uses 36 px horizontal desktop padding and 16 px mobile padding. It does not reconstruct production UI. Chrome and Vite are closed after each run. No production files are edited by this harness.

Vite uses a dedicated ignored dependency cache so this runner can execute alongside the minuta preview without stale optimized dependencies.
