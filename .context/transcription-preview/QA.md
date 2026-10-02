# Transcription visual QA — 2026-10-02

Command: `node .context/transcription-preview/capture.mjs` — exit 0.

Inspected the actual production panel, upload, review, editor and status components with the app CSS/Tailwind tokens. The only aliases replace the transcription repository and convocação reader. No production files were changed by this harness.

Twelve screenshots cover empty, processing, review and reviewed states at 1440 px desktop and 390 px mobile, plus expanded locate/replace in both review states. All twelve were visually inspected. No layout issue was found: desktop keeps the text workspace and audio/actions sidebar aligned; mobile stacks the workspace, player and actions; optional upload content and expanded search controls fit within the viewport.

`layout-report.json` records document and body widths equal to the viewport in every capture, no browser errors and no external requests. The valid local WAV decoded to a one-second duration without errors. Completed review text is read-only, replacement is disabled, and search navigation remains available. Search tools start collapsed in both review states.

The raw `overflowElements` diagnostic lists the translated inner Radix progress bar in processing states. It is intentionally clipped by the progress container (`overflow-hidden`); it creates no document/body overflow and no visible clipping problem.

Screenshots:

| State | Desktop | Mobile |
| --- | --- | --- |
| Empty | [empty-desktop.png](empty-desktop.png) | [empty-mobile.png](empty-mobile.png) |
| Processing | [processing-desktop.png](processing-desktop.png) | [processing-mobile.png](processing-mobile.png) |
| Review | [review-desktop.png](review-desktop.png) | [review-mobile.png](review-mobile.png) |
| Review, expanded search | [review-expanded-desktop.png](review-expanded-desktop.png) | [review-expanded-mobile.png](review-expanded-mobile.png) |
| Reviewed | [reviewed-desktop.png](reviewed-desktop.png) | [reviewed-mobile.png](reviewed-mobile.png) |
| Reviewed, expanded search | [reviewed-expanded-desktop.png](reviewed-expanded-desktop.png) | [reviewed-expanded-mobile.png](reviewed-expanded-mobile.png) |

The runner disables animations during screenshot capture to settle the disclosure chevron and keep artifacts deterministic. Functional assertions run on the actual components before capture.
