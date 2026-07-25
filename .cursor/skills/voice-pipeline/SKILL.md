---
name: voice-pipeline
description: Wire or debug the audio loop for the AI Communication Coach — microphone capture, Wispr Flow streaming transcription, fal Whisper word-timestamp analysis, and speech output through fal and Addis AI. Use when touching audio, recording, transcription, pronunciation metrics, or voice playback.
---

# Voice Pipeline

Two transcribers run on every learner turn, and they exist for opposite reasons. Getting this backwards produces a coach that cannot see the errors it is supposed to correct.

- **Wispr Flow** streams over WebSocket during the turn. It drives the on-screen transcript and reaches the conversation director immediately. It is optimised to *clean speech up* — it strips fillers and silently repairs slips — so it is the polished track, never the graded one.
- **fal Whisper** runs on the recorded turn with `chunk_level: "word"`. Verbatim, with a start and end timestamp on every word. This is the analysis track, and every measurement comes from it.

The gap between the two transcripts is a product feature: "what you said" beside "how it could sound."

## Verified constants

These come from the live API docs and are the ones that break silently.

**Addis AI Realtime** (`wss://relay.addisassistant.com/ws`) — client sends PCM16 mono at **16 kHz**, server returns PCM16 mono at **24 kHz**. Browser `AudioContext` hands you Float32 in the range -1 to 1; convert to Int16 before sending or you transmit static. Audio goes as a JSON envelope with `data` and `mimeType`, not raw binary. A `1006` close almost always means one of those three.

**Wispr Flow** — base64 16 kHz mono PCM16, 25 MB / 6 minutes per turn. Pass `context.dictionary_context` with Ethiopian names and domain terms (`"Addis Ababa University"`, `"Sheraton Addis"`, `"software engineering"`) to keep proper nouns intact.

**fal Whisper** — `chunk_level: "word"` for the analysis track; `"segment"` gives you nothing useful for pause detection. Upload with `fal.storage.upload(file)` to get an `audio_url`, and use `fal.queue.submit` with a `webhookUrl` for anything long enough to feel slow.

**Speech output splits by language.** Addis AI TTS speaks Amharic and Afan Oromo only — the English coach voice comes from a fal TTS endpoint. Punctuate Amharic with Ge'ez marks (`፣` `።`) because the model derives pausing from them, and keep English fragments out of Amharic sentences; let the fal English voice read the model sentence instead.

## Keys stay server-side

Every provider key lives on the Node API. The browser gets a short-lived Wispr Flow client JWT and nothing else. The Addis docs show `apiKey` as a WebSocket query parameter and the fal client warns against exposing `FAL_KEY` — both mean proxy through Render rather than shipping the key to the page.

## Metrics come from timestamps

From `data.chunks`, each `{ text, timestamp: [start, end] }`:

- Words per minute over speech time, excluding leading and trailing silence.
- Pause count and total pause length, counting gaps above 0.7s between adjacent words.
- Filler rate: `um`, `uh`, `eh` per 100 words, from the verbatim track only.
- Mean sentence length: verbatim word count over sentence count from the punctuated transcript.

Store these as `turn.metrics_json` — they describe an utterance, not a competency. They reach the Confidence dimension as *evidence*: pause ratio and hesitation rate produce an `observed` for the delivery sub-competencies, which update mastery the ordinary way. Never compute a dashboard number directly from a metric.

`P001.01`–`P003` need phoneme scoring that no API here provides; they are `observable: false`. The one workable probe is a minimal-pair drill judged by the transcriber — target "ship", transcriber returns "sheep", score the target missed.

## Order of work

Build the analysis track before the conversation. A working measurement path with no coach is a demo; a coach with invented numbers is a liability.

1. Record a turn, upload, transcribe with word chunks, print the metrics. Verify against a stopwatch on one recording.
2. Stream Wispr Flow to the on-screen transcript.
3. Feed the director, speak the reply through fal English TTS.
4. Add the Amharic correction line through Addis TTS.

## Done when

- One recording produces metrics that match a hand count of pauses and words.
- The verbatim track still contains the learner's fillers and tense errors after passing through the pipeline.
- No provider key appears in any client bundle.
- Amharic and English audio come from their respective providers, with Ge'ez punctuation intact in the Amharic text.
