# Building a prop that survives a poke

A prop fails when a judge does something slightly off-script and the illusion tears. These are the moves that keep it intact.

## Fake the input, not the output

Hardcoding the output freezes the screen the moment anything varies. Hardcode the **input** and let real code run on it.

Seeding Hana's Week Four scores directly means the progress chart is a picture. Seeding four weeks of `attempt` rows and letting the real mastery update compute the scores means the chart is a chart — it redraws correctly if a judge completes another session on stage, and the code path is the shipping one.

This is the difference between a prop that reads as real and a prop that *is* real on a narrow input set. Always reach for the second.

## Keep live latency

Instant is a tell. A cached audio clip that returns in 4ms where the real call takes 1.2s reads as fake even when nobody can say why. Play the cached asset behind the same loading state, with a delay in the neighbourhood of the real thing.

The same applies in reverse: a prop that takes eight seconds because nobody optimised the fixture load is worse than the real call.

## Degrade toward the story

Every prop needs a defined behaviour for off-script input, and that behaviour should land somewhere in the narrative rather than on an error screen.

If a judge says something the scripted branch does not cover, the coach should respond with a genuine, generic coaching turn — "Say a little more about that" — and continue. A stumble that stays in character is invisible. A stack trace is fatal.

## One switch, checked in

Props live behind a single flag with an obvious name, set in one place:

```ts
export const DEMO_MODE = process.env.DEMO_MODE === "1";
```

Two reasons. You can prove the real path exists by flipping it, which is a strong answer to "so is any of this real?" And you avoid the failure where half the props are on and half are off during the pitch because they were toggled independently.

## Reset must be one command

The demo will be run more than once — rehearsal, the judges, then the judge who comes back afterwards wanting to try it. Resetting to the opening state is a single command, and it is part of rehearsal, not something discovered at the table.

```bash
pnpm demo:reset
```

## Props that are also real

The strongest props are real calls, made early and cached: Amharic TTS clips, stimulus images, the Firecrawl content pack. They cannot lie about capability, they cannot fail on stage, and pre-generation is what the shipping architecture does anyway.

Prefer this shape whenever the underlying call is deterministic enough to cache. It costs one script run and buys a prop with no downside.
