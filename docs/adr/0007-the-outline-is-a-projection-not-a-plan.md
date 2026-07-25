# The 30-day outline is a projection, not a plan

The learner can see a thirty-day outline. It names domains, the order they come in, and what they will be able to do at the end of each. It is computed on every render from the learner profile and stored nowhere.

This looks like a reversal of [`0001-stimulus-pool-not-prebuilt-plans.md`](./0001-stimulus-pool-not-prebuilt-plans.md), which removed the "30-day plan" outright, and it is not. The two describe different objects, and the distinction is the whole decision.

A **plan** is a sequence of Day Plans. `buildDayPlan` reads mastery, retrievability and prerequisite state, so day nine's plan is a function of what happened on days one through eight. On day one those inputs do not exist, which is why ADR 0001 removed the stored plan and why nothing here brings it back.

An **outline** is the arc over the curriculum: which domains, in which order, roughly how long each takes at the learner's budget. Every input to that is known at onboarding — `domain_priority` from the Life Path, the domain list from the placed CEFR band, `estimatedDays` from the curriculum, the load table row from `daily_minutes`. `session-engine.md` §9 already states that these questions "are computed on demand from life path, CEFR and completion state". The outline is that computation, given a screen.

## Why show it at all

Because the product's central claim is that practice is going somewhere, and until now the learner only ever saw one day of it. "Today's Mission" with no visible arc is indistinguishable from an endless stream of exercises, which is the exact complaint that open-ended conversation practice attracts and the thing Life Paths exist to answer. The screen where a learner decides whether to come back tomorrow is the one that shows them where tomorrow leads.

## Considered options

**Store the outline at sign-up.** Rejected, and this is the option that would actually reverse ADR 0001. A stored outline has to be invalidated when the learner is promoted, when a domain completes early, when they change their daily budget or their Life Path — every one of which is a chance for the screen and the engine to disagree. Deriving it makes that class of bug unrepresentable.

**Show concrete sessions per day.** Rejected because it would be a lie. Which template runs on day twelve depends on `score(T)` against mastery that does not exist yet, and the `sameTemplateAsLastTimeFor` penalty means it depends on days ten and eleven specifically.

**Show nothing above the Day Plan.** The status quo, and the most conservative reading of ADR 0001. Rejected: the ADR forbade *storing* a plan, not answering "what comes next", and it says so.

## Consequences

Three properties are load-bearing and should be preserved by anything that touches `client/lib/study-outline.ts`.

`projectOutline` is a pure function of `(profile, completedDomainIds)`. It has no state and no fetch, so there is nothing to invalidate and the screen cannot drift from the engine.

It names domains and objectives, never competencies or templates. Those are chosen the morning of. A future version may show which competencies a domain contains, since that is static curriculum, but never which will be scheduled when.

It reshapes as evidence arrives, and the screen says so in the copy rather than only in this file. Before placement it carries a stronger caveat still: the band underneath it is assumed rather than measured, which makes the whole projection a guess, and an outline that hides that is worse than no outline.

Day counts scale sub-linearly with the daily budget — the exponent in `daysForDomain` is 0.45, not 1. Forty-five minutes a day does not finish a domain four and a half times faster than ten, because `R(c, date)` decays on wall-clock days and consolidation is the constraint rather than minutes. A bigger budget buys review depth, not calendar speed.

`reachesNextBand` is phrased on screen as a possibility, never a promise. Covering every A2 domain inside thirty days is necessary for promotion and not sufficient: promotion needs every `core` competency at mastery ≥ 0.75 with `evidence_count` ≥ 3, which the calendar cannot guarantee.
