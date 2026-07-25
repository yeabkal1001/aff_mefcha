---
name: demo-rehearsal
description: Rehearse the five-minute demo end to end and harden every failure point before the pitch.
disable-model-invocation: true
---

# Demo Rehearsal

The demo is a five-minute performance with six beats, scripted at the end of `Persona.md`. Rehearsal is where you find out which beats depend on something you cannot control from the table.

Run this at least three hours before the pitch. Found problems need time to become fallbacks.

## 1. Cold run

Start from a machine state that matches the pitch: services asleep, browser closed, database at its opening state.

Run all six beats without stopping to fix anything. Take notes; resist the urge to open an editor. You are measuring the experience, not debugging.

Record two numbers per beat: how long it took, and where the audience's attention would have drifted.

## 2. Inventory the failure points

Walk the beats again and name everything between the click and the pixel that a room full of people could break. The usual set here:

- **Render free-tier spin-down.** A cold API costs fifteen seconds of silence on stage. Warm it with a ping before you walk up, and again while the previous team presents.
- **Conference wifi.** Every provider call is a round trip over a network you do not control.
- **Microphone permission.** A fresh browser profile prompts for it, mid-beat.
- **Audio output.** The room's system, not your laptop speakers.
- **A provider erroring or rate-limiting** at exactly the wrong moment.

For each one, decide the fallback now: pre-rendered asset, cached response, or a screenshot you can talk over. A fallback you invent on stage is not a fallback.

## 3. Pre-record the round trips

Every audio round trip in the scripted path gets a cached real asset behind the same loading state, chosen by the `DEMO_MODE` flag. This is the single highest-value hardening move: it removes the network from the critical path while keeping the demo honest, because the cached assets are real provider output.

Keep the live path one flag away, and rehearse flipping it. "Here it is running live" is the strongest possible answer to a skeptical judge, and it is only available if you have tried it in the room.

## 4. Reset and repeat

Run `pnpm demo:reset`, then perform the whole thing again, out loud, at pitch pace. Two clean cold runs back to back is the bar. One clean run is luck.

The second run is also where you rehearse the recovery lines — what you say while something loads, and the one honest sentence for each prop when a judge asks whether it is real.

## 5. Prepare for the questions

Judges reliably ask three things. Have the answer ready as a click, not a paragraph:

- **"Is that score real?"** → Speak a different sentence into it and let the number move.
- **"What happens on day three?"** → The scheduler screen. This is the beat that wins it; be able to reach it in one click from anywhere.
- **"How does this scale past one learner?"** → Samuel, same engine, different Life Path skin.

## Done when

- Two consecutive cold runs completed with no intervention.
- Every failure point from step 2 has a fallback that has been triggered on purpose at least once.
- `pnpm demo:reset` returns the app to the opening state in one command.
- Each prop's honest one-liner has been said out loud.
- The Day Three screen is reachable in one click from any point in the demo.
