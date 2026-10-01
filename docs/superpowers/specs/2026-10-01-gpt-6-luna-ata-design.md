# GPT-6 Luna in ATA minuta model options

## Goal

Let an administrator select GPT-6 Luna for generating ATA minutes from reviewed transcripts.

## Design

Add the API model ID `gpt-6-luna` to the model selector on **Configurações → Atas** with the label **GPT-6 Luna**. Keep the currently saved/default model unchanged. The setting already stores a model ID as text, the generation service sends that value to the OpenAI Responses API, and the existing **Testar modelo** action verifies whether the configured API key can access it; this change therefore needs no database migration or API contract change.

The transcription worker remains unchanged. GPT-6 Luna supports text and the Responses API, but its model documentation says audio is not supported. The feature is only for minute generation from transcript text.

Official model reference: https://developers.openai.com/api/docs/models/gpt-6-luna

## Acceptance criteria

- The ATA minuta model selector offers `gpt-6-luna` with the visible label **GPT-6 Luna**.
- Existing model options and the currently saved/default value remain unchanged.
- An administrator can save the new ID and use **Testar modelo** to verify API access.
- Audio transcription continues using its existing audio-specific model.

## Out of scope

- Changing the default model, reasoning effort, or system prompt.
- Adding GPT-6 Luna to audio transcription.
- Database or deployment configuration changes.
