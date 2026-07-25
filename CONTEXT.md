# AI Communication Coach

An AI speaking coach for Ethiopian students and professionals. This glossary is the binding vocabulary for the product: code, prompts, UI copy and documents all use these words with these meanings.

## Language

### Curriculum

**Skill**:
One of the four master libraries: Vocabulary, Grammar, Pronunciation, Fluency.
_Avoid_: dimension, category, area

**Competency**:
A top-level library entry such as `V001`, `G005`, `P012`, `F002`. Appears in curriculum requirements and template `elicits` rows, and nowhere else.
_Avoid_: topic, concept, skill

**Sub-competency**:
The addressable unit, such as `G006.01`. Everything that targets, scores, schedules or stores a learning objective addresses this level.
_Avoid_: sub-skill, micro-skill, objective

**Domain**:
A Layer 1 curriculum unit such as `A2-D01`, six per CEFR level from A2 to C2. A unit of *what is practised*, never a unit of *why the learner is here*.
_Avoid_: unit, chapter, course, module

**Template**:
A Layer 2 exercise form, `EX001` through `EX018`. A form, not an instance of one.
_Avoid_: exercise type, activity, drill

**CEFR**:
The complexity band a learner is working at, A2 through C2. Measured by the onboarding assessment and by promotion, never self-declared.
_Avoid_: level, difficulty, grade

### Practice

**Session**:
One activity — one template, one stimulus, three to eight minutes.
_Avoid_: exercise, lesson, task

**Day Plan**:
Four to six sessions under one theme, shown to the learner as **Today's Mission**.
_Avoid_: lesson, module, mission (in code)

**Stimulus**:
The material a session gives the learner to respond to: an image, an audio clip, a scenario, a topic.
_Avoid_: prompt, content, media

**Stimulus Pool**:
The store of stimulus assets built ahead of time, each addressed by template, target set and theme. Sessions read from it; they never generate during a session.
_Avoid_: cache, asset store

**Turn**:
One uninterrupted stretch of learner speech inside a session, carrying its audio, both transcripts, and its delivery metrics.
_Avoid_: utterance, response, recording

**Attempt**:
The judgement of one sub-competency from one turn — either the first try or a scaffolded retry.
_Avoid_: try, response, answer

**Evidence**:
One session's observation of one sub-competency, however many attempts it took to produce. What `evidence_count` counts.
_Avoid_: sample, data point, observation

**Opportunity**:
A place in a turn where a target sub-competency could correctly have been used. The denominator of Observed.
_Avoid_: chance, instance, slot

**Observed**:
The share of a turn's opportunities for one sub-competency that the learner produced correctly. The only input to a mastery update. A turn with no opportunities yields no evidence rather than a zero.
_Avoid_: score, result, grade

**Error Tag**:
A named, pre-authored mistake pattern belonging to a sub-competency, matched against the verbatim transcript so that predictable errors are graded the same way every time.
_Avoid_: mistake, issue, flag

**Scaffold**:
A rung of support offered after a failed attempt: a narrowing question, two offered words, or a model sentence to repeat. A scaffolded success is weaker evidence than an unscaffolded one.
_Avoid_: hint, help, prompt

**Practice Context**:
An authored real-world situation belonging to a Domain, such as "Introducing yourself".
_Avoid_: context (bare), scenario

**Context Substitution**:
A Life Path's rewrite of a Practice Context into that path's world — "Introducing yourself" becomes "Introducing yourself to a university class".
_Avoid_: context (bare)

**Theme**:
The substituted Practice Context that gives one Day Plan its single story, and the third part of the Stimulus Pool address.
_Avoid_: topic, subject

### The learner model

**Learner**:
The person practising. There is no separate account concept, so this is the only word for them, in prose and in schema alike — `learner_id`, `learner_profile`, `learner_competency`.
_Avoid_: user, student, customer

**Life Path**:
Why the learner is here. A skin over the curriculum: domain priorities, context substitutions, a vocabulary overlay, and template preferences. Never a separate curriculum.
_Avoid_: goal, track, persona

**Mastery**:
The estimate of how well a learner can perform one sub-competency, updated from observed evidence and weighted by how reliably the template observes that skill.
_Avoid_: score, level, proficiency

**Retrievability**:
How likely the learner is to recall a sub-competency right now, decaying from the last successful retrieval. Distinct from Mastery: retrievability falls with time alone, mastery does not.
_Avoid_: recall, retention, freshness

**Stability**:
How slowly a given sub-competency's retrievability decays for this learner. Rises with successful retrieval, resets on repeated failure.
_Avoid_: strength, interval

**Due**:
The state of a sub-competency whose retrievability has fallen below the review threshold. The learner sees a due count; the Profile does not move when something falls due.
_Avoid_: expired, stale, forgotten

**Communication Rings**:
Speak, Learn, Improve. Daily activity and consistency — they measure showing up.
_Avoid_: streaks, goals

**Communication Profile**:
The six Profile Dimensions together — they measure getting better.
_Avoid_: dashboard, stats, scorecard

**Profile Dimension**:
A named weighted bundle of sub-competency IDs, four fixed plus two from the Life Path. Always computed from the learner model, never stored. Every member must be reachable at the learner's band, which is why there is no Confidence or Presentation dimension — see `docs/adr/0006-confidence-and-presentation-are-not-dimensions.md`.
_Avoid_: ring, score, stat, metric

Rings and Profile Dimensions are different objects and the words are never interchanged. Rings are about showing up; the Profile is about getting better.
