# Session Generation Engine

How the Master Competency Libraries, Layer 1 Curriculum, and Layer 2 Exercise Templates connect so that a complete, personalized session is assembled automatically from a learner profile.

This extends the curriculum documents in [`../curriculum/`](../curriculum/). It does not replace the libraries, the domains, or the templates — it makes them addressable to each other. Every change is listed with its justification in the final section.

---

## 1. Diagnosis: the three broken links

The existing design has all the right parts and no wiring between them.

**Link 1 is too coarse.** Layer 1 requires competencies at the top level. `A2-D01` requires `V001 Personal Information` and `G005 Present Simple`. But `V001` contains eight sub-competencies and `G005` contains six. A session is three to eight minutes and can target maybe two or three sub-competencies. Generating from `G005` gives the model no instruction about whether today is third-person singular or habits and routines, so it picks arbitrarily and coverage becomes random.

**Link 2 doesn't exist in machine-readable form.** `EX001 Picture Description` evaluates "Articles", "Prepositions", "Subject–verb agreement", "Word stress". Those are the *names* of `G002`, `G011`, `G005.04`, `P005`. The link is already there in prose — it was just never given IDs. Nothing in the system can currently answer "which templates can exercise `G011.02`?"

**Link 3 was never specified.** Nothing says which template suits which competency. `P001 Individual Consonant Sounds` cannot be practiced through `EX016 Debate`, and `F014 Debate` cannot be practiced through `EX006 Shadowing`. Without an explicit affordance model, the selector will produce nonsense pairings.

Everything below fixes exactly these three links, plus the blank fields the original session schema declares but never defines (`Retry Rules`, `Spaced Review Rule`, `Evaluation Metrics`).

---

## 2. Upgrade 1 — One ID space, used by everything

Finish the Version 2 recommendation the document already makes for vocabulary, and apply it everywhere. Every addressable unit is `X###.##`, where `X ∈ {V, G, P, F}`.

```
V001.01  Name & Identity
G006.01  Actions Happening Now
P005.01  Primary Stress
F002.01  Describe People
```

Grammar, pronunciation and fluency already carry these IDs. Vocabulary needs them assigned (the document shows the pattern for `V009` only). This is the precondition for everything else: the curriculum, the templates, the learner state, and the generated session all address the same objects.

**Why it's an upgrade:** without a shared address space, every link between layers has to be re-derived by an LLM at generation time, which is slow, expensive, and non-deterministic. With it, linkage is a database join.

---

## 3. Upgrade 2 — Competency records carry generation metadata

A competency in the library is currently a name and a CEFR band. To generate against it, the record needs to say what a correct performance looks like and how it can be observed.

```json
{
  "id": "G006.01",
  "parent": "G006",
  "name": "Actions Happening Now",
  "skill": "grammar",
  "cefr_min": "A2",
  "cefr_max": "B2",
  "prerequisites": ["G005.01", "G001.01"],
  "observable": true,
  "elicitation_cues": [
    "describing a photograph of an action in progress",
    "answering 'what is happening right now?'"
  ],
  "success_criteria": "Uses be + present participle for actions in progress; does not substitute bare present simple.",
  "common_errors": [
    { "wrong": "I am study", "right": "I am studying", "tag": "missing_participle" },
    { "wrong": "I study now", "right": "I am studying now", "tag": "tense_substitution" }
  ],
  "l1_risk": { "am": 0.7 }
}
```

Three fields do real work. `prerequisites` at sub-competency level makes the document's prerequisite graphs executable rather than illustrative. `elicitation_cues` gives the stimulus generator concrete instructions. `common_errors` gives the evaluator a closed set to match against before falling back to open-ended LLM judgement, which makes scoring far more consistent and much cheaper.

`l1_risk` is keyed by native language, and it's how `P001.08 Common L1 Sound Confusions` stops being a placeholder. For Amharic speakers, prioritize `/p/` versus `/b/` (*programming*, *presentation*), `/v/` versus `/b/`, consonant-cluster epenthesis, and `/θ/` and `/ð/`. Any competency with a high `l1_risk` for the learner's L1 gets a priority boost automatically.

**Why it's an upgrade:** it moves knowledge that currently lives only in the prompt into the data, so the same competency is taught and scored identically every time, and so error detection can be deterministic where the error is predictable.

---

## 4. Upgrade 3 — Curriculum requirements become weighted rows

Layer 1 keeps its current authored form. What changes is that each requirement becomes a row with a role, and sub-competency detail is supplied only where it matters.

```json
{
  "domain": "A2-D01",
  "requires": [
    { "competency": "V001", "role": "core",       "subs": ["V001.01","V001.02","V001.03","V001.05"] },
    { "competency": "G005", "role": "core",       "subs": ["G005.01","G005.04","G005.05"] },
    { "competency": "G006", "role": "core",       "subs": ["G006.01","G006.05"] },
    { "competency": "V002", "role": "supporting" },
    { "competency": "P005", "role": "supporting" },
    { "competency": "F002", "role": "core",       "subs": ["F002.01"] },
    { "competency": "P014", "role": "incidental" }
  ]
}
```

The three roles carry different weight in target selection and different authoring cost:

| Role | Weight | Sub-competencies | Meaning |
| --- | --- | --- | --- |
| `core` | 1.0 | listed explicitly | The domain exists to teach these; mastery gates domain completion |
| `supporting` | 0.6 | expanded automatically from the parent, filtered by CEFR | Needed to perform the domain, but not the point of it |
| `incidental` | 0.2 | expanded automatically | Always measured when observable, never the reason for a session |

**Why it's an upgrade:** the flat lists in the current curriculum give `A2-D01` twenty-two competencies of apparently equal importance, which makes "have they finished this domain?" unanswerable. Roles make completion a defined condition (all `core` subs at mastery ≥ threshold) while keeping authoring cost low, because only `core` requires hand-listing.

---

## 5. Upgrade 4 — Templates become capability descriptors

This is the central change. Replace each template's prose evaluation section with a structured descriptor. The prose stays as human documentation; the descriptor is what the engine reads.

```json
{
  "id": "EX001",
  "name": "Picture Description",
  "family": "observation_description",
  "stimulus_type": "image",
  "interaction_mode": "monologue",
  "cefr_min": "A2",
  "cefr_max": "C1",
  "duration_minutes": [3, 6],
  "requires_fluency": ["F002.02"],

  "measures": {
    "vocabulary":    0.90,
    "grammar":       0.75,
    "pronunciation": 0.40,
    "fluency":       0.80
  },

  "elicits": [
    { "competency": "V*",      "strength": 0.9, "note": "topic vocabulary follows the image subject" },
    { "competency": "G002",    "strength": 0.9 },
    { "competency": "G011.02", "strength": 0.9 },
    { "competency": "G005.04", "strength": 0.8 },
    { "competency": "G006.01", "strength": 0.9 },
    { "competency": "G009.01", "strength": 0.8 },
    { "competency": "P005",    "strength": 0.5 },
    { "competency": "P006",    "strength": 0.5 },
    { "competency": "P014",    "strength": 0.6 },
    { "competency": "F002.01", "strength": 0.9 },
    { "competency": "F002.02", "strength": 0.9 }
  ],

  "scaffold_ladder": [
    "reask with a narrowing question",
    "offer two target words",
    "provide the model sentence, learner repeats"
  ]
}
```

Two distinct numbers, and the distinction matters.

`elicits` is **production probability** — how reliably this template makes the learner *produce* the structure. A picture of an action in progress almost forces present continuous, so `G006.01` scores 0.9.

`measures` is **observation reliability** — how much the resulting performance tells you about that skill dimension. `EX001` produces a short monologue, so it barely samples pronunciation: 0.40. `EX006 Shadowing` inverts this, with pronunciation at 0.95 and vocabulary near zero because the words are given.

The wildcard `V*` means the template is vocabulary-agnostic: it exercises whatever vocabulary the stimulus depicts, so any `V` competency can be routed through it by choosing the image subject. Grammar, pronunciation and fluency are never wildcarded, because templates genuinely constrain which of those appear.

The sparse `elicits` list is what makes authoring tractable. Eighteen templates against ninety-six competencies is 1,728 possible pairs, but the overwhelming majority are zero. In practice each template links to roughly ten to twenty competencies, so the whole matrix is about 220 authored rows — a few hours of work, done once, entirely static.

`requires_fluency` prevents impossible assignments: a learner who has not reached `F009 Expressing Opinions` will never be handed `EX016 Debate`, regardless of how urgently a grammar competency is due.

`scaffold_ladder` fills the blank `Retry Rules` field, described in section 7.

---

## 6. Upgrade 5 — Learner state, and the two blank rules

Per learner, per sub-competency, one row:

```json
{
  "learner_id": "hana",
  "competency": "G006.01",
  "mastery": 0.42,
  "stability_days": 2.4,
  "evidence_count": 3,
  "last_seen": "2026-07-24T18:00:00Z",
  "last_template": "EX007",
  "last_theme": "university_intro",
  "error_tags": { "missing_participle": 2 }
}
```

**Retrievability** decays from the last successful retrieval:

```
R(c, t) = exp( -(t - last_seen) / stability_days )
```

A competency is **due** when `R < 0.85`. This is the document's blank `Spaced Review Rule`, now defined, and it derives review timing from the learner's actual performance rather than a fixed interval ladder.

**`observed` is a ratio, not a judgement.** For each targeted competency the evaluator returns a structured count rather than a score:

```json
{ "competency": "G006.01", "opportunities": 3, "correct": 1, "error_tags": ["missing_participle", "missing_participle"] }
```

`observed = correct / opportunities`. Asking a model for a number in `[0, 1]` directly would reintroduce the session-to-session drift that authored `common_errors` exist to eliminate, and every quantity downstream — mastery, Profile Dimensions, promotion, the retry trigger — is a function of this one number.

One rule matters more than it looks: **`opportunities = 0` produces no evidence, not a zero.** A learner who avoids a structure has told you nothing about whether she can use it, and scoring silence as failure would punish exactly the hesitant beginners this product exists for.

**Evidence is counted once per session and competency**, however many attempts it took. Retries within a session are all stored, but they resolve to a single mastery update taken from the final attempt at its scaffolded weight:

```
α        = max(0.15, 1 / (1 + evidence_count))
weight   = template.measures[skill] × (scaffolded ? 0.6 : 1.0)
mastery ← mastery + α × weight × (observed - mastery)
stability_days ← stability_days × (1 + 0.9 × (observed - 0.5))
evidence_count ← evidence_count + 1
```

Counting each retry as separate evidence would break two things at once. A *failed* session with two retries would reach the `evidence_count ≥ 3` promotion floor, so struggling would accelerate promotion; and `α` would collapse fastest for the learners whose estimates most need to keep moving.

The `weight` term is why the `measures` reliability score exists: evidence from a template that observes a skill poorly moves the estimate less than evidence from one that observes it well. Without this, a shadowing exercise and a picture description would update a pronunciation estimate identically, which is plainly wrong.

**Retry Rules**, the other blank field, now have a definition. A retry triggers when `observed < 0.6` on any competency the session explicitly targeted. Maximum two retries per target. Each retry climbs one rung of the template's `scaffold_ladder`. Only the final attempt updates mastery, at the reduced 0.6 weight, because a scaffolded success is weaker evidence than an unscaffolded one. If the second retry still fails, the competency's `stability_days` resets to 1.0 and its prerequisites are re-checked — a repeated failure at `G012` should surface as a `G007` problem, which is precisely the diagnostic use the document proposes for the grammar prerequisite graph.

**Reflection**, stage six of the learning engine, writes back too. The learner names what changed; if their self-report matches the detected `error_tag`, raise `evidence_count` confidence rather than mastery itself. Metacognitive accuracy tells you the estimate is trustworthy, not that the skill is stronger.

---

## 7. Upgrade 6 — Life Path as a context skin

[`../product/persona.md`](../product/persona.md) argues the primary organizing choice should be *why* the learner is here, not their level. The curriculum is organized by level. Both can be true, because they are different axes: **CEFR sets complexity, the Life Path sets context.**

A Life Path never duplicates curriculum. It is four overlays on the existing one:

```json
{
  "id": "university_success",
  "domain_priority": { "A2-D01": 1.0, "A2-D06": 0.9, "A2-D02": 0.4, "A2-D03": 0.2 },
  "context_substitutions": {
    "Introducing yourself": "Introducing yourself to a university class",
    "Meeting someone new": "Meeting your project group for the first time",
    "Talking about hobbies": "Explaining why you chose your major"
  },
  "vocabulary_overlay": ["major", "lecture", "assignment", "semester", "campus"],
  "template_preference": { "EX018": 1.3, "EX017": 1.2, "EX008": 1.1, "EX002": 0.8 }
}
```

`A2-D01` stays a single universal domain. Hana sees it as a university classroom; Samuel sees the same competencies inside a hotel lobby. Six Life Paths cost six small config files instead of six parallel curricula.

**Why it's an upgrade:** it resolves the contradiction between the two source documents without discarding either, and it keeps curriculum authoring linear in the number of domains rather than multiplied by the number of paths.

---

## 8. Upgrade 7 — Profile Dimensions are named bundles

A naming note first, because two things were both being called rings. **Communication Rings** (Speak, Learn, Improve) are the daily activity rings from the MVP document; they measure showing up. **Profile Dimensions** are what the Communication Profile displays; they measure getting better. This section is about the second one only.

The MVP document promised eight dimensions; the library has four skills. Rather than maintain two scoring systems, define a dimension as a **named weighted subset of the ID space**:

```json
{ "dimension": "grammar",       "fixed": true,  "members": ["G*"] }
{ "dimension": "vocabulary",    "fixed": true,  "members": ["V*"] }
{ "dimension": "pronunciation", "fixed": true,  "members": ["P*"] }
{ "dimension": "fluency",       "fixed": true,  "members": ["F*"] }

{ "dimension": "classroom_interaction", "life_path": "university_success", "members": ["F003.*", "F004.*"] }
{ "dimension": "explaining_your_work",  "life_path": "university_success", "members": ["F002.*", "F007.*"] }

{ "dimension": "guest_interaction",     "life_path": "hospitality",        "members": ["F007.*", "F003.*"] }
{ "dimension": "complaint_handling",    "life_path": "hospitality",        "members": ["F020.*", "F011.*"] }
```

Every learner sees **four fixed dimensions** — Grammar, Vocabulary, Pronunciation, Fluency — plus **exactly two supplied by their Life Path**. Six in total. Hana sees Classroom Interaction and Explaining Your Work because she is on `university_success`; Samuel sees Guest Interaction and Complaint Handling because he is on `hospitality`.

Two per path is a rule, not a coincidence — the dashboard is a fixed six-slot layout, so a path supplying one or three would break it. Dimensions may be shared between paths: `guest_interaction` and `classroom_interaction` both draw on `F003`, because answering a question is answering a question wherever you are standing.

**Every member of every dimension must be reachable at the band the learner is working in.** This is the constraint that shapes the list above, and it is not a detail. `F015 Presentation` is B2–C2; `F013 Discussion` and `F009 Expressing Opinions` are B1–C2; `P015 Expressiveness` — whose `P015.03` is named "Confidence" — is B2–C2. Earlier drafts built Presentation, Academic Discussion and Confidence out of exactly those, which at A2 meant three of eight slots that could never move. The A2-reachable Fluency competencies are `F001`, `F002`, `F003`, `F004`, `F005`, `F007` and `F020`, and every path dimension above is built from them. See [`../adr/0006-confidence-and-presentation-are-not-dimensions.md`](../adr/0006-confidence-and-presentation-are-not-dimensions.md).

A dimension's value is the evidence-weighted mean mastery of its members, restricted to competencies the learner has actually attempted. **Every dimension, without exception.**

### Delivery metrics are evidence, not a dimension

Pause ratio, hesitation rate, mean turn length and response latency come out of a turn's fal Whisper word timestamps. They are real signals and they must not become a second source of truth on the dashboard, so they produce an `observed` for the sub-competencies they are evidence *about*, which then update mastery through the ordinary path in section 6:

| Metric | Evidence for |
| --- | --- |
| Hesitation rate, filled pauses | `F020.05` Buying Thinking Time Naturally |
| Response latency | `F003.*` Answering Questions |
| Mean turn length | `F002.*` Describing, `F005.*` Storytelling |
| Pause ratio, speech rate | `F001.05` Quick Recall |

Every target is A2-reachable and lands inside Fluency, which is where `EX001`'s own evaluation block already files "Hesitation frequency" and "Speech rate". Note that `P013 Pausing & Chunking` is the intuitive home for pause ratio and is deliberately *not* used: it is B1–C2, and routing A2 evidence into it would recreate the unreachable-member problem this section exists to prevent. It becomes the right target once a learner is promoted.

These metrics used to be gathered under a Confidence dimension. Measuring delivery and calling it confidence was a claim about the learner's internal state that the evidence does not support.

Three display rules keep the numbers honest. A dimension with no attempted members shows "not yet assessed" rather than 0%. A dimension whose members all have `evidence_count = 1` is drawn with a wider uncertainty band. And **no dimension decays** — retrievability falls with time, mastery does not, so a learner returning after a month finds her Profile where she left it. That is deliberate: time-decay surfaces instead as a due count and the Improve ring, so the three learner-facing surfaces stay distinct — Rings mean showing up, the Profile means getting better, the due count means act now. Dropping someone's visible score for time passing rather than for anything they did is the mechanic Duolingo removed for being demoralising.

The onboarding assessment exists to seed enough evidence that no fixed dimension starts empty.

**Why it's an upgrade:** new dimensions become configuration, not schema changes. Nothing is scored twice, and the dashboard can never disagree with the learner model, because it *is* the learner model.

---

## 9. The generation pipeline

Three moments: once at onboarding, once per plan, once per day.

### Onboarding assessment (once)

The learner is never asked to declare a CEFR level. Most don't know it and the ones who think they do usually guess high. Instead, run three short sessions across different modes and let the engine measure production:

| Order | Template | Mode | Seeds |
| --- | --- | --- | --- |
| 1 | `EX001` Picture Description | monologue | Vocabulary, Grammar, baseline delivery metrics |
| 2 | `EX007` Personal Questions | dialogue | Fluency, response latency, `F003.*` Answering Questions |
| 3 | `EX009` Personal Experience | monologue | Narrative tense control, sentence length, Storytelling |

Roughly four minutes of speech. Each targeted competency is written with `evidence_count = 1`, which is deliberately weak: `α = 1/(1+1) = 0.5`, so the second week of real sessions can move an estimate substantially. That is why the profile appears to improve quickly at first — not a trick, just a wide prior narrowing.

**Placement is a separate job from seeding, and must be.** Assigning the level as "the highest band where the seeded competencies average ≥ 0.5" cannot work, because these three sessions have to use stimuli pitched at some band before the band is known. Probe at A2 and a B2 speaker scores 1.0 on A2 competencies while producing no evidence whatsoever about B1 or B2 ones — so their average is undefined, not high, and the rule can never return anything above the band you happened to probe at.

Placement therefore runs off a **global complexity read of the speech itself**: mean sentence length, subordination rate, lexical range, and error density across all three samples. This needs no band-specific content, because it measures the language the learner produced rather than checking her against a syllabus. Ties round down; starting a learner too low costs one easy week, starting them too high costs her confidence.

Competency seeding then happens inside the placed band, which is what fills the fixed dimensions. Because only A2 content is authored, the MVP places everyone at A2 — but by a mechanism that will place higher the moment B1 content exists, rather than one that merely appeared to work.

### CEFR promotion

Promote when **every `core` competency across the level's domains reaches mastery ≥ 0.75 with `evidence_count` ≥ 3**. The evidence floor matters: without it, a single lucky session on a rarely-practiced competency could promote a learner who isn't ready. It is also why evidence is counted per session rather than per attempt — see section 6.

Promotion needs no regeneration step, because nothing was generated. The next morning's Day Plan calls `highestPriorityIncompleteDomain(life_path, cefr)` against the new band and selects a new domain by itself.

### Nothing is stored above the Day Plan

Earlier drafts referred to a "30-day plan" and to "the learning plan". Neither exists. Every question above the Day Plan — which domain comes next, how far the learner is from B1 — is computed on demand from life path, CEFR and completion state, so there is no plan to hold, invalidate, or regenerate. What *is* built ahead of time is the Stimulus Pool, described in section 12.

The learner does see a **thirty-day outline**, and it is that on-demand computation given a screen rather than a return of the stored plan. It names domains, their order and their objectives — all knowable from `domain_priority`, the placed band and `estimatedDays` — and never names a competency or a template, because those are selected the morning of from evidence that does not exist yet. It is a pure function, recomputed on every render, so it cannot drift from the engine. See [`../adr/0007-the-outline-is-a-projection-not-a-plan.md`](../adr/0007-the-outline-is-a-projection-not-a-plan.md).

### Day Plan (the learner-facing "Today's Mission")

This also resolves a conflict between the source documents: the load table budgets four to six activities per day, while Hana's mission reads as a single ten-minute conversation. A Mission is the **themed Day Plan**; the sessions are the activities inside it. The theme comes from the Life Path context substitution, which is why it feels like one story rather than four drills.

```
function buildDayPlan(profile, date):
    budget   = LOAD_TABLE[profile.cefr]          # minutes, session count, new/review split
    domain   = highestPriorityIncompleteDomain(profile.life_path, profile.cefr)

    reviewPool = allCompetencies(profile)
                   .where(R(c, date) < 0.85)
                   .orderBy(priority desc)
                   .take(budget.reviews)

    newPool    = domain.requirements
                   .where(role == "core" or role == "supporting")
                   .where(prerequisitesMet(c, profile))
                   .where(mastery(c) < 0.5)
                   .orderBy(priority desc)
                   .take(budget.new_concepts)

    theme    = profile.life_path.context_substitutions[domain.practice_contexts.next()]
    targets  = groupIntoSessions(newPool + reviewPool, budget.sessions)

    return targets.map(t => buildSession(t, profile, theme))
```

Priority for any candidate competency:

```
priority(c) = 0.35 × reviewUrgency(c)          # 1 - R(c, t), zero for unseen items
            + 0.25 × domainWeight(c)           # 1.0 core / 0.6 supporting / 0.2 incidental
            + 0.15 × pathWeight(c)             # from the Life Path overlay
            + 0.15 × errorRecency(c)           # decayed count of recent error_tags
            + 0.10 × l1Risk(c, profile.l1)     # Amharic interference boost
```

### Session

```
function buildSession(targets, profile, theme):
    candidates = TEMPLATES
        .where(cefr_min <= profile.cefr <= cefr_max)
        .where(requires_fluency ⊆ unlocked(profile))
        .where(duration fits remaining budget)

    score(T) = Σ_{c ∈ targets} priority(c) × elicits(T, c) × measures(T, skill(c))
             + 0.20 × life_path.template_preference[T]
             - 0.30 × usedInLastNSessions(T)
             - 0.40 × sameTemplateAsLastTimeFor(targets)     # enforces "new context"
             - 0.15 × sameStimulusTypeAsPreviousSession(T)
             - 0.25 × assetMissing(T, targets, theme)        # pool availability, soft

    T = argmax score
    stimulus = poolRead(T.stimulus_type, targets, theme)     # never generates inline
    return Session{ ... }
```

The `sameTemplateAsLastTimeFor` penalty is stage eight of the learning engine expressed as a constraint. Reviewing `G007.01` through a different template with a different stimulus theme *is* "spaced retrieval in a new context," now enforced mechanically instead of by intention.

`assetMissing` is a **soft** term, deliberately. Filtering out templates with no ready asset would let the cache silently outrank the curriculum; scoring them down instead means a strongly indicated template still wins, queues its own asset in the background, and falls back for this session only. Resolving availability inside `score(T)` rather than swapping the template afterwards also keeps one useful property: the template the engine chose is always the template the learner got. On day three, "the scheduler picked a different template on its own" stays a checkable claim rather than something the cache might have done.

### Emitted session

The document's session schema, with every previously undefined field now populated:

```json
{
  "session_id": "s_20260726_02",
  "skill_focus": "grammar",
  "template": "EX001",
  "cefr": "A2",
  "learning_objective": "Describe an action in progress using present continuous.",
  "targets": [
    { "competency": "G006.01", "role": "new",    "priority": 0.81 },
    { "competency": "V001.05", "role": "review", "priority": 0.64 },
    { "competency": "P005.01", "role": "incidental" }
  ],
  "stimulus": { "type": "image", "asset_id": "img_lecture_hall_01",
                "spec": "A student standing at the front of a university classroom, presenting to seated classmates" },
  "prompt": "You are introducing yourself to this class. Tell them what is happening and who you are.",
  "expected_duration_minutes": 5,
  "evaluation_metrics": {
    "G006.01": { "criteria": "be + present participle", "error_tags": ["missing_participle","tense_substitution"], "weight": 0.75 },
    "V001.05": { "criteria": "states field of study using topic vocabulary", "weight": 0.90 },
    "P005.01": { "criteria": "primary stress on engineering, programming", "weight": 0.40 }
  },
  "retry_rules": { "trigger_below": 0.6, "max_retries": 2, "scaffold_ladder": ["EX001.scaffold_ladder"] },
  "reflection_prompt": "What changed between your first answer and your second?",
  "spaced_review_rule": { "model": "exp_decay", "target_retrievability": 0.85 },
  "feedback_language": "am"
}
```

Note that `evaluation_metrics` is no longer prose. It is the target list joined to competency `success_criteria` and `common_errors`, weighted by the template's observation reliability. The evaluator prompt is generated from this, so scoring is consistent across sessions by construction.

---

## 10. Worked example: Hana

**Profile:** A2, L1 Amharic, age band 18–24, Life Path `university_success`, field software engineering, 20 min/day, corrections in English explained in Amharic. Day 1, no history.

Load table gives A2 four sessions, two to three new concepts, two reviews. Day 1 has nothing due, so all slots go to new concepts. Life Path priority puts `A2-D01 Personal Life` first, and its practice context "Introducing yourself" is substituted to "Introducing yourself to a university class" — the mission theme.

Target selection from `A2-D01` core requirements, ranked by priority:

| Competency | Domain weight | L1 risk | Priority | Why |
| --- | --- | --- | --- | --- |
| `G006.01` Actions Happening Now | core 1.0 | — | 0.81 | Prerequisite `G005.01` met; the exact structure behind "I am study" |
| `V001.05` Occupation | core 1.0 | — | 0.64 | Carries "software engineering", the field she must name |
| `F002.01` Describe People | core 1.0 | — | 0.61 | Self-description is the mission |
| `P001.08` /p/ vs /b/ | supporting 0.6 | 0.7 (am) | 0.58 | Amharic interference on *programming*, *presentation* |

Template selection for session two, targeting `G006.01` + `V001.05`:

| Template | Score | Outcome |
| --- | --- | --- |
| `EX001` Picture Description | 0.81×0.9×0.75 + 0.64×0.9×0.90 = **1.07** | Selected — an image of a student presenting nearly forces present continuous |
| `EX018` Roleplay | 0.95 | Strong, and boosted by the path preference, but held for session four so the day varies |
| `EX006` Shadowing | 0.08 | Rejected; measures vocabulary at ~0 |
| `EX016` Debate | — | Excluded by `requires_fluency: F009`, which Hana has not unlocked |

Hana says *"I am study software engineering."* The evaluator matches `missing_participle` from `G006.01.common_errors` deterministically — no open-ended judgement needed. `observed = 0.3`, below the 0.6 trigger, so a retry fires at scaffold rung one. Feedback is delivered in Amharic through Addis AI TTS; the model English sentence is spoken by the fal English voice.

She retries correctly. Mastery updates with `α = 1.0` capped at first evidence, `weight = 0.75 × 0.6` for the scaffold, giving roughly 0.34; `stability_days` rises to about 1.7, so `G006.01` comes due in roughly two days — and when it does, the `sameTemplateAsLastTimeFor` penalty pushes the selector toward `EX018` with a different theme. That is the week-two callback in [`../product/persona.md`](../product/persona.md), produced by the scheduler rather than scripted.

---

## 11. Data model

```
competency(id, parent, skill, name, cefr_min, cefr_max, observable,
           success_criteria, elicitation_cues, l1_risk_json)
competency_prereq(competency_id, requires_id)
competency_error(competency_id, wrong, right, tag)

domain(id, cefr, name, description)
domain_objective(domain_id, text)
domain_context(domain_id, text)
domain_requires(domain_id, competency_id, role, explicit_subs_json)

template(id, family, stimulus_type, interaction_mode, cefr_min, cefr_max,
         duration_min, duration_max, scaffold_ladder_json)
template_measures(template_id, skill, reliability)
template_elicits(template_id, competency_id, strength)      -- ~220 rows
template_requires(template_id, competency_id)

life_path(id, name)
life_path_domain(life_path_id, domain_id, priority)
life_path_context(life_path_id, from_context, to_context)
life_path_template_pref(life_path_id, template_id, multiplier)

dimension(id, name, fixed, life_path_id)
dimension_member(dimension_id, competency_pattern, weight)

stimulus_pool(id, template_id, target_set_key, theme, stimulus_type,
              asset_url, spec_json, created_at)

learner_profile(learner_id, cefr, l1, age_band, gender, life_path_id,
                study_field, daily_minutes, feedback_language, goal_date)
learner_competency(learner_id, competency_id, mastery, stability_days,
                   evidence_count, last_seen, last_template, last_theme)
learner_error(learner_id, competency_id, tag, count, last_seen)

day_plan(id, learner_id, date, domain_id, theme)
session(id, day_plan_id, template_id, stimulus_id, prompt, spec_json)
session_target(session_id, competency_id, role, priority)
turn(id, session_id, index, audio_url,
     transcript_verbatim, transcript_clean, metrics_json)
attempt(id, turn_id, competency_id, opportunities, correct,
        scaffold_level, is_final)
reflection(session_id, learner_text, matched_error_tag)
```

Four things about this shape are load-bearing.

**`turn` and `attempt` are separate.** A turn is one utterance and owns everything utterance-shaped: the audio, both transcripts, the word-timestamp metrics. An attempt is one competency judgement about that turn. Keeping them merged meant writing the same transcript and the same timestamps to three rows whenever a single sentence was evidence for grammar, vocabulary and pronunciation at once — and it left the API plan's "per-turn raw metrics" with nowhere to live.

**`attempt` stores counts, not a score.** `observed` is `correct / opportunities`, computed at read time for the same reason Profile Dimensions are: a stored derived number is a number that can disagree with its inputs. `is_final` marks the attempt that updates mastery, since retries are all recorded but only one of them counts as evidence.

**`dimension` has no `derived_metrics_json`.** Delivery metrics reach the Profile as evidence on competencies, never as a parallel input to a dimension.

**There is no `learning_plan`.** See section 9.

The first three groups plus `stimulus_pool` are static and shared by all learners. Only the `learner_*`, `day_plan`, `session`, `turn`, `attempt` and `reflection` tables grow per learner.

---

## 12. Stimulus generation, and where the APIs attach

The `stimulus_type` field routes directly to the services in [`integrations.md`](./integrations.md):

| Stimulus type | Source | Templates |
| --- | --- | --- |
| image, two images, image sequence | fal image model, prompted from `elicitation_cues` + theme | EX001, EX002, EX003, EX011, EX013, EX014, EX015 |
| audio | fal English TTS | EX004, EX005, EX006 |
| scenario, statement, topic, text | LLM, constrained by targets + Life Path context | EX007–EX010, EX012, EX016–EX018 |
| real-world material | Exa discovery → Firecrawl extraction, cached per Life Path | any template, as thematic source |

### The Stimulus Pool

Stimulus is never generated inside a session — a fal image costs five to fifteen seconds, and a coaching conversation cannot stop for it. But it also cannot all be built up front, because a Day Plan depends on mastery and retrievability that only exist once the learner has practised. Pre-build **assets, not plans**.

The Stimulus Pool holds assets addressed by `(template, target_set, theme)`. A nightly job projects what each learner is likely to need — competencies coming due in the next few days, the core requirements of the current domain, the themes reachable from her Life Path — and tops the pool up through fal's queue. The learner's morning is a database read.

Keying on the target set and theme rather than the session is what makes review work: a competency coming due in a new context requests a *variant* of an existing spec rather than a fresh invention, which keeps review images recognizably parallel to the originals — milk spilling after coffee spilling, exactly as the pedagogy document describes.

### On a pool miss, degrade the key, not the experience

The projection will sometimes be wrong. When it is, walk down the key rather than showing a spinner:

1. The exact key `(template, target_set, theme)`.
2. The same targets under a **generic theme** — right competencies, less tailored setting.
3. A template whose `stimulus_type` is text (`EX007`, `EX018`), which needs no asset at all.

Queue the missing asset in the background as you go, so the same miss never happens twice. The learner never waits, and the worst case is a slightly less personal scenario rather than dead air — which matters most in exactly the moment it is most likely to bite, live on stage.

---

## 13. Hackathon slice

Ninety-six competencies, thirty domains and eighteen templates is a roadmap. To prove this engine works in a weekend you need only a slice, and most of that slice is now written — see [`../curriculum/content-pack-a2-d01.md`](../curriculum/content-pack-a2-d01.md).

- **Competencies:** the `A2-D01` core set, fifteen sub-competencies with full metadata. ✅ authored
- **Domain:** `A2-D01` with roles assigned. ✅ authored
- **Templates:** `EX001`, `EX007`, `EX018` with complete descriptors. ✅ authored. Three templates is the minimum that makes template *selection* visible rather than trivial.
- **Life Paths:** `university_success` and `hospitality`, to show the same domain skinning two ways. Still to write.
- **Everything else** — retrievability, mastery update, retry ladder, Profile Dimensions — is code, not content, and runs against whatever is authored.

The demo that proves the architecture is day one and day three for Hana. Day one, the engine selects `G006.01` and picks `EX001`. Day three, the same competency comes due, and the engine picks a *different* template with a *different* stimulus without anyone scripting it. That single moment demonstrates competency library, curriculum, template matrix, learner model and scheduler all working as one system.

**Day three arrives by clock injection.** Hana's day-one attempts are real rows written by the real pipeline during rehearsal, not hand-authored fixtures. The demo then advances `now()` by seventy-two hours and runs the actual scheduler live. The only fake thing in the room is the date — which is what makes it survive the hard question, because "try it with a different number of days" still works.

---

## 14. Change log

Each entry names the failure in the current design that it fixes.

| # | Change | Failure it fixes | Cost |
| --- | --- | --- | --- |
| 1 | Sub-competency IDs across all four libraries | Sessions can't be generated against a competency containing eight unrelated sub-skills | Assign IDs to `V001–V030` |
| 2 | `success_criteria`, `elicitation_cues`, `common_errors`, `l1_risk` on competency records | Scoring drifts between sessions; `P001.08` was an unfillable placeholder | Author per competency, once |
| 3 | Requirement roles (`core`/`supporting`/`incidental`) with explicit subs for core | Twenty-two equal-weight competencies per domain make completion undefinable | Light: only core needs hand-listing |
| 4 | Template descriptors with separate `elicits` and `measures` scores | Nothing could answer "which template exercises this competency?"; unreliable evidence was treated as reliable | ~220 static rows |
| 5 | `requires_fluency` gate on templates | Nothing prevented assigning Debate to an A2 learner | 18 short lists |
| 6 | Retrievability model `R = exp(-Δt/S)` | `Spaced Review Rule` was a named but empty field | Code only |
| 7 | Mastery update weighted by observation reliability | No defined path from performance to a Communication Profile number | Code only |
| 8 | Retry trigger, scaffold ladder, prerequisite re-check on repeat failure | `Retry Rules` was a named but empty field | One ladder per template |
| 9 | Life Path as domain priority + context substitution + vocabulary overlay + template preference | Two source documents disagreed on the primary organizing axis | 6 config files |
| 10 | Profile Dimensions as named bundles: 4 fixed + 2 per Life Path | Eight dimensions and four skills were two incompatible scoring systems, and three of the eight bundled competencies unreachable at A2 | Config only |
| 11 | Day Plan as the "Today's Mission" container | Load table said 4–6 activities; persona doc said one 10-minute mission | Naming and grouping |
| 12 | `sameTemplateAsLastTimeFor` penalty in template scoring | "Spaced retrieval in a new context" was an intention with no mechanism | Code only |

Entries 13 to 20 came out of a grilling session against this document. The five that carry real trade-offs are recorded as ADRs in `docs/adr/`.

| # | Change | Failure it fixes | Cost |
| --- | --- | --- | --- |
| 13 | Stimulus Pool replaces pre-built plans; nothing stored above the Day Plan | "Plans built once, read daily" was impossible — a Day Plan reads mastery and retrievability that don't exist yet | One table, nightly job |
| 14 | Asset availability as a soft term in `score(T)`, with a degrade-the-key fallback | A missing asset silently swapped the template after selection, making "the engine chose this" unfalsifiable | Code only |
| 15 | The Profile reads only from mastery; decay surfaces as a due count | Dimensions had no decay story, and a learner away for a month saw an unchanged Profile with no prompt to return | Code only |
| 16 | Delivery metrics become evidence on competencies, not a parallel scorer | Confidence was the one dimension not computed from the learner model, breaking section 8's own invariant | Metric-to-competency mapping |
| 21 | Confidence and Presentation dropped; the Profile is 4 fixed + 2 per path | Three of eight dimensions bundled B1–C2 competencies an A2 learner can never attempt, so they could never move | Config only |
| 17 | `turn` split from `attempt`; evidence counted per session-and-competency | Utterance data written to competency rows; a *failed* session with two retries reached the promotion floor | Schema |
| 18 | `observed = correct / opportunities`; zero opportunities yields no evidence | The number every other quantity depends on had no definition, and silence would have scored zero | Evaluator prompt |
| 19 | Placement decoupled from seeding via a global complexity read | Placement could never return a band above the one it happened to probe at | Code only |
| 20 | `learner_*` replaces `user_*` | The glossary and the schema disagreed on the central noun | Rename |

Two things deliberately left unchanged: the exercise template prose stays as human documentation beside the descriptors, and the CEFR-by-domain curriculum structure is untouched. The Life Path skin was specifically designed to avoid reorganizing it.

### Resolved since first draft

- **CEFR promotion** is now defined in section 9: all `core` competencies at mastery ≥ 0.75 with `evidence_count` ≥ 3.
- **The onboarding assessment** is now defined in section 9 as three seeding sessions.
- **`B1-D01` and `B1-D02`** have been authored into [`../curriculum/domains.md`](../curriculum/domains.md), bringing every level to six domains.
- **Pre-generation** is resolved by the Stimulus Pool in section 12: assets are built ahead, plans are not.
- **What counts as evidence** is resolved in section 6: one session-and-competency pair, however many attempts.
- **Where `observed` comes from** is resolved in section 6: an opportunity ratio from a structured evaluator return.
- **How Confidence is computed** is resolved in section 8 by removing it: delivery metrics became evidence on A2-reachable competencies, and there is no Confidence dimension to compute.
- **How placement finds a ceiling** is resolved in section 9: a global complexity read, independent of the probe band.

### Still open

- **Segmental pronunciation** (`P001`–`P003`) has no scoring path with the current API stack. The minimal-pair-through-transcription proxy covers deliberately probed sounds only. Those competencies are marked `observable: false` so the engine never targets what it cannot grade, and they are excluded from the Pronunciation dimension's mean rather than counted as zero.
- **Interruption handling.** The template model assumes the learner completes a turn. Addis AI's Realtime mode allows the coach to interrupt, which no current template describes. Out of scope for the hackathon; revisit if free-talk mode becomes a graded surface.
- **Turning a delivery metric into an `observed`.** Section 8 fixes which competency each metric is evidence for, but not the thresholds: what hesitation rate counts as a correct use of `F020.05`, and over what window. Authoring, not design.
- **Pool projection tuning.** How far ahead the nightly job should look, and how wide to cast for themes, is a cost-versus-miss-rate tradeoff with no data behind it yet. The fallback chain means getting it wrong degrades gracefully.
