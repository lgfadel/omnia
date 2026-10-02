# Local minuta visual QA

This harness imports the actual `AtaMinutaPanel` and its child components, the app's actual global CSS, and the existing Tailwind configuration. Only the Supabase repository and download modules are replaced with deterministic local fixtures. It makes no external requests and never loads account credentials.

Fixtures are selected through `?state=preparation` or `?state=ready`. The preparation includes a 34 MB support PDF fixture; the ready state includes a complete document, two saved versions, initial instructions and a later refinement.

Run from the repository root: `node .context/atas-minuta-preview/capture.mjs`. The runner starts local Vite, captures desktop (1440 px) and mobile (390 px) screenshots, checks horizontal overflow, then closes Vite and Chrome. The expanded screenshots also inspect support-document and history layouts.

The transcription UX release also captures the shared editor with expanded locate/replace tools (`ready-*-editor-tools.png`) and verifies no overflow or browser errors in desktop/mobile minuta editing. Screenshot animations are disabled to capture settled controls.
