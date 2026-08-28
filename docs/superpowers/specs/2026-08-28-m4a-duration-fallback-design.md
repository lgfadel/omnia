# M4A duration fallback design

## Goal

Allow a supported recording to be uploaded when the browser cannot report its
duration, while preserving the six-hour limit at the worker that processes the
audio.

## Context

`Avenida Canadá.m4a` is a supported M4A recording. `ffprobe` reports a
duration of 9307.050667 seconds (2h35m07s), but the browser metadata API
reports a non-finite duration. The client currently turns that browser-specific
metadata limitation into a blocking error before uploading the file.

## Design

`readAudioDuration` returns `null` when metadata loads without a finite,
positive duration or when the media element cannot open the metadata. These are
browser capability limits, not authoritative evidence that the recording is
invalid.

The client validation accepts a missing duration for a supported format. It
continues to reject an explicit duration above six hours. The upload boundary
and its Edge Function accept an optional duration and persist `NULL` when it
is unknown; the table already permits this value. The worker continues to read
the uploaded object with `ffprobe` and rejects recordings above six hours
before processing.

## Error handling

Unsupported formats remain blocked locally. The worker remains the
authoritative duration and media-validity check whenever the browser cannot
inspect a supported recording.

## Testing

Add regression coverage for a supported M4A whose duration is unavailable and
for an explicitly over-limit recording. The component test proves that an
unavailable duration reaches the upload boundary rather than showing the
duration error.
