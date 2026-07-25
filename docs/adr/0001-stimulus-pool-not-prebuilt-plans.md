# Stimulus assets are pooled; nothing above the Day Plan is stored

A Day Plan reads mastery, retrievability and prerequisite state, none of which are knowable in advance, so the "30-day plan" the early drafts described could never have been built — yet stimulus genuinely cannot be generated inside a session, because a fal image costs five to fifteen seconds. We resolved this by pre-building assets rather than plans: a Stimulus Pool addressed by `(template, target_set, theme)` is topped up nightly, Day Plans are assembled each morning and only ever read from it, and everything above the Day Plan (which domain comes next, what the path to B1 looks like) is computed on demand from life path, CEFR and completion state rather than stored.

## Consequences

There is no `learning_plan` table and CEFR promotion has no regeneration step — the next morning's Day Plan simply selects a new domain. Asset availability enters `score(T)` as a soft penalty, so a strongly indicated template still wins and queues its own asset in the background. On a pool miss the key degrades before the experience does: exact key, then the same targets under a generic theme, then a template whose stimulus is text and needs no asset at all.
