# M4A Duration Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload supported M4A recordings even when browser metadata does not expose a duration, while retaining the six-hour protection in the worker.

**Architecture:** The browser supplies a duration only when it is finite and positive. The shared client validator treats an absent duration as unknown rather than invalid, and the upload repository accepts that optional value. The existing worker validates the stored audio with `ffprobe`, which remains the authoritative enforcement point.

**Tech Stack:** Next.js client component, TypeScript, Vitest, Supabase Storage upload, Node.js worker with FFmpeg.

## Global Constraints

- Do not relax format validation.
- Do not permit a client-known duration greater than 21,600 seconds.
- Do not modify the worker's `ffprobe` duration check.
- Keep user-facing errors in Portuguese.

---

### Task 1: Represent unavailable browser duration

**Files:**

- Modify: `apps/web-next/src/lib/ataTranscription.ts:10-49`
- Test: `apps/web-next/src/lib/__tests__/ataTranscription.test.ts:9-43`

**Interfaces:**

- Consumes: file name, MIME type, and `durationSeconds` from the upload panel.
- Produces: `getAudioValidationError(input): string | null`, with `durationSeconds: number | null`.

- [ ] **Step 1: Write the failing test**

```ts
it('accepts a supported M4A when the browser cannot report its duration', () => {
  expect(getAudioValidationError({ name: 'Avenida Canadá.m4a', type: 'audio/mp4', durationSeconds: null })).toBeNull()
})
```

- [ ] **Step 2: Run it to verify it fails**

Run `npm run test -- --run src/lib/__tests__/ataTranscription.test.ts`.
Expected: TypeScript compilation fails because the input only accepts `number`.

- [ ] **Step 3: Write the minimal implementation**

Change the input type to `number | null`, and only reject invalid values when
`durationSeconds !== null`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run `npm run test -- --run src/lib/__tests__/ataTranscription.test.ts`.
Expected: the new fallback test and the existing over-limit test pass.

- [ ] **Step 5: Commit**

Stage the test and library implementation, then run:

```bash
git commit -m "fix(atas): allow M4A uploads with unavailable metadata"
```

### Task 2: Send unknown duration to the authoritative worker validation

**Files:**

- Modify: `apps/web-next/src/components/atas/AtaTranscriptionPanel.tsx:25-171`
- Modify: `apps/web-next/src/repositories/ataTranscriptionsRepo.supabase.ts:125-142`
- Test: `apps/web-next/src/components/atas/__tests__/AtaTranscriptionPanel.test.tsx`

**Interfaces:**

- Consumes: `readAudioDuration(file): Promise<number | null>` and `getAudioValidationError`.
- Produces: `ataTranscriptionsRepoSupabase.upload(ataId, file, durationSeconds: number | null, contextText?)`.

- [ ] **Step 1: Write the failing component test**

Configure an audio element whose `loadedmetadata` event exposes `NaN`, select a
supported M4A through the hidden input, and assert that the upload repository
receives the same file and `null` duration.

- [ ] **Step 2: Run it to verify it fails**

Run `npm run test -- --run src/components/atas/__tests__/AtaTranscriptionPanel.test.tsx`.
Expected: the duration error is shown and the upload repository is not called.

- [ ] **Step 3: Write the minimal implementation**

After `loadedmetadata`, resolve `null` unless `audio.duration` is finite and
positive. Update upload state and repository parameter types to `number | null`.
Keep a genuine media-element error as a rejection.

- [ ] **Step 4: Run focused tests to verify they pass**

Run `npm run test -- --run src/lib/__tests__/ataTranscription.test.ts src/components/atas/__tests__/AtaTranscriptionPanel.test.tsx`.
Expected: all focused tests pass.

- [ ] **Step 5: Run project verification**

Run `npm run type-check && npm run test:run && npm run build`.
Expected: all commands exit 0.

- [ ] **Step 6: Commit**

Stage the component, repository, and regression tests, then run:

```bash
git commit -m "fix(atas): fall back to worker duration validation"
```
