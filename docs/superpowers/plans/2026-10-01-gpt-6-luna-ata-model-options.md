# Add GPT-6 Luna to ATA minuta model options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GPT-6 Luna selectable for ATA minuta generation without changing the saved default or audio transcription.

**Architecture:** Add the official API model ID and a distinct visible label to the existing `modelOptions` array used by the ATA configuration dropdown. Settings persistence and generation already accept a dynamic model ID, so no server, database, or transcription-worker changes are needed.

**Tech Stack:** Next.js, React, TypeScript, Vitest.

## Global Constraints

- Add `gpt-6-luna` only to the ATA minuta model selector.
- Keep the currently saved/default model unchanged.
- Keep the audio transcription model unchanged; GPT-6 Luna does not support audio.
- Do not change the API contract, database schema, reasoning effort, or system prompt.

---

### Task 1: Add GPT-6 Luna to the ATA minuta selector

**Files:**
- Modify: `apps/web-next/src/app/config/atas/page.tsx:18-25`

**Interfaces:**
- Consumes: `modelOptions: { value: string; label: string }[]`, rendered by the existing `SelectItem` mapping.
- Produces: a selectable `{ value: 'gpt-6-luna', label: 'GPT-6 Luna' }` option; the settings API and Responses generation flow continue consuming the same model ID string.

- [x] **Step 1: Add the model option**

Append this entry to `modelOptions`, after the existing GPT-5.6 entries:

```ts
{ value: 'gpt-6-luna', label: 'GPT-6 Luna' },
```

Do not change the state initialization, database default, or transcription worker.

- [x] **Step 2: Check the patch**

Run: `git diff --check`

Expected: no whitespace errors; the only application change is the new model option.

- [x] **Step 3: Type-check and build the web app**

Run: `npm run type-check && npm run build`

Expected: both commands exit successfully.

- [x] **Step 4: Run the existing test suite**

Run: `npm run test:run`

Expected: the existing Vitest suite passes. Do not add a test that only mirrors the new static option entry.

- [x] **Step 5: Commit the implementation**

```bash
git add apps/web-next/src/app/config/atas/page.tsx
git commit -m "feat(atas): add GPT-6 Luna model option"
```
