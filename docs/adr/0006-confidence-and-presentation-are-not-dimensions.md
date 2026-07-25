# Confidence and Presentation are not Profile Dimensions

The Communication Profile is six dimensions, not eight: Grammar, Vocabulary, Pronunciation and Fluency fixed for every learner, plus two supplied by the Life Path. Confidence and Presentation are removed.

The reason is reachability, and it is checkable against the curriculum. `F015 Presentation` is **B2–C2**. `P015 Expressiveness`, whose `P015.03` is literally named "Confidence", is **B2–C2**. `academic_discussion` bundled `F013` and `F009`, both **B1–C2**. The MVP places every learner at A2 and only A2 content is authored, so all three dimensions bundled sub-competencies the learner cannot attempt. Under the display rule in [`../architecture/session-engine.md`](../architecture/session-engine.md) they would read "not yet assessed" indefinitely — three of eight slots on the screen the pitch ends on, permanently blank. The persona's "Presentation 22% → 59%" was unearnable by the engine that was supposed to produce it.

Confidence had a second problem that survives any amount of content authoring. The signals behind it are real — pause ratio, hesitation rate, mean turn length, response latency, all computed from fal Whisper word timestamps — but they measure **delivery**. Calling delivery "Confidence" is an inference about a learner's internal state that the evidence does not support, and it is the kind of claim a judge is right to push on.

## Considered options

**Keep eight by backfilling two A2-reachable dimensions.** Rejected: it preserves a slot count that was never load-bearing. Eight came from the MVP document, not from anything the learner model requires.

**Keep Confidence, renamed to Delivery.** Defensible, and it would have kept the persona's headline number. Rejected because the delivery metrics already have somewhere better to go — the sub-competencies they are evidence *about* — and a dimension whose only purpose is to re-display evidence already counted inside Fluency is double-counting with extra steps.

**Keep the unreachable dimensions and label them "unlocks at B1".** Honest, and it shows the roadmap. Rejected for the demo: the Profile is the screen that has to move, and a third of it that cannot move undercuts the argument.

## Consequences

The delivery metrics need a home, which also closes the mapping that section 8 previously left unwritten. Hesitation rate and filled pauses become evidence on `F020.05 Buying Thinking Time Naturally`; response latency on `F003.* Answering Questions`; mean turn length on `F002.* Describing` and `F005.* Storytelling`. All are A2-reachable, all update mastery through the ordinary path, and all land inside Fluency — which is where `EX001`'s own evaluation block already files "Hesitation frequency" and "Speech rate". [`0002-profile-reads-only-mastery.md`](./0002-profile-reads-only-mastery.md) is unaffected: nothing reaches the Profile except through mastery.

The Life Path dimensions are rebuilt from A2-reachable competencies rather than trimmed. `university_success` supplies Classroom Interaction (`F003.*`, `F004.*`) and Explaining Your Work (`F002.*`, `F007.*`). `hospitality` supplies Guest Interaction (`F007.*`, `F003.*`) and Complaint Handling (`F020.*`, `F011.*`). `interview_readiness` retires from `hospitality` and waits for the `job_interview` path, where it belongs.

Two per path is now the rule, for the same reason three was: the dashboard is a fixed layout, and a path supplying one or three would break it.

The persona's numbers change. Confidence 39% → 47% was the story's headline gain and no longer exists; Fluency 44% → 49% carries that beat instead.
