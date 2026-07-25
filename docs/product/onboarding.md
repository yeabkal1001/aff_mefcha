# Onboarding

How a stranger becomes a learner with a seeded profile, and why sign-up is the
last step rather than the first.

Read [`persona.md`](./persona.md) for the story this serves and
[`../architecture/session-engine.md`](../architecture/session-engine.md) §9 for
the placement and seeding mechanics referenced throughout.

## The one rule

**A question ships only if it changes a generated session.** Everything the
onboarding collects is an input to `buildDayPlan`, and every field maps to a
column on `learner_profile`. Anything that would merely be nice to know is a
question we are charging the learner to answer and then ignoring.

The corollary, from `persona.md`: **we never ask for an English level.** Most
learners don't know theirs, and the ones who think they do guess high. Level is
measured from four minutes of speech, not declared.

## Experience before account

Sign-up sits after the first mission, not before it.

The reason is that nothing before that point needs an account. Placement,
seeding and the first Day Plan all run against a draft profile held on the
device. Asking for an email first would gate the only thing that can convince
someone this is worth an email — hearing the coach catch a mistake they didn't
know they were making, and fixing it in the same breath.

So the ask changes shape. It is not "create an account to begin". It is "you
just moved Grammar 62% → 68% — save it" at the moment the learner has something
to lose. Everything gathered anonymously is attached to the new account on
sign-up; nothing is re-asked.

The trade is that a learner who closes the tab before signing up is gone. We
accept that, and mitigate it by persisting the draft locally so a returning
learner resumes rather than restarts.

## The flow

| # | Screen | Collects | `learner_profile` | What it changes downstream |
| --- | --- | --- | --- | --- |
| 1 | Welcome | — | — | One call to action. No account, no level question. |
| 2 | Name | name | `learner.name` | The coach greets by name — "Hi Hana" — from the first line. |
| 3 | Age | band | `age_band` | Sets scenario framing and vocabulary register, so a fifteen-year-old and a forty-year-old are not handed the same scene. Banded, because nothing downstream needs a birthday. |
| 4 | Gender | how to refer to them | `gender` | The narrowest question here: it changes how the coach speaks about the learner and nothing else. Not the curriculum, not the scenes, not the scoring. |
| 5 | Native language | L1 | `l1` | `l1_risk` contributes 10% of competency priority. Amharic promotes `/p/`–`/b/`, `/v/`–`/b/`, cluster epenthesis, `/θ/`–`/ð/`. Also names the language offered in step 9. |
| 6 | Life Path | why they are here | `life_path_id` | The largest single lever: `domain_priority`, `context_substitutions`, `vocabulary_overlay`, `template_preference`, and both of the path Profile Dimensions. |
| 7 | Field, role or goal | study field | `study_field` | Seeds vocabulary overlay and stimulus themes. The question is conditioned on step 6 — a course for university, a target role for hospitality, and on the custom path the goal itself, written free-hand. |
| 8 | Daily time | minutes per day | `daily_minutes` | Selects the `LOAD_TABLE` row: session count, new-concept and review split. |
| 9 | Feedback language | correction language | `feedback_language` | English only, or English with the explanation spoken in the learner's language by Addis AI TTS. |
| 10 | Goal date *(skippable)* | deadline | `goal_date` | Framing today, priority weighting later. The only optional question. |
| 11 | Mic check | — | — | Permission and a live level read, before it can fail mid-assessment. Advancing requires actually being heard: a muted headset grants permission perfectly well and then records silence. |
| 12 | `EX001` Picture description | speech | — | Vocabulary, Grammar, baseline delivery metrics. |
| 13 | `EX007` Personal questions | speech | — | Fluency, response latency, `F003.*` Answering Questions. |
| 14 | `EX009` Personal experience | speech | — | Narrative tense control, sentence length, `F005.*` Storytelling. |
| 15 | Profile reveal | — | `cefr` | Placement from the global complexity read; seeding at `evidence_count = 1`. |
| 16 | First mission | — | — | The practice screen. |
| 17 | Sign-up | email | — | Attaches everything above to a real account. |

Steps 1–10 are roughly two minutes. Steps 12–14 are about four minutes of
speech in total. The demo script budgets thirty seconds for the questions and
sixty for the assessment, so both are cut for time on stage — see the script at
the end of `persona.md`.

### Two questions that had to justify themselves

Age and gender are the two that most easily become unexamined demographic
fields, so they are held to the same rule as everything else.

Age earns a screen because register is a real generator input: the scene a
mission is set in, and the vocabulary overlay that comes with it, should differ
for a school student and a working adult. It is banded rather than exact
because nothing downstream resolves finer than that.

Gender earns a screen on much thinner grounds — it changes how the coach refers
to the learner and nothing else. It is kept because a coach that gets this
wrong for four minutes is worse than a coach that asked, and "prefer not to
say" is a first-class answer rather than a fallback.

### Why there is no "your language only" correction

The feedback step offers English only, or English with the reasoning explained
in the learner's language. It deliberately does not offer the learner's
language alone.

A correction the learner never hears in English gives them nothing to repeat,
and the retry is the step the entire immediate-feedback loop rests on. Hana has
to hear "I am studying Software Engineering" before she can say it back.

## Why one question per screen

The onboarding is the learner's first conversation with the coach, so it is
staged as one: the orb is present on every step, the question reads as
something it asked, and the answer is the learner's turn. A seven-field form
would collect the same data and teach the learner nothing about what the
product is.

It also keeps each answer cheap to revise. Back never loses work.

## Life Paths

Eight paths are shown because the choice is the product's argument — the
learner picks *why*, not what level. Four are usable today.

Each live path supplies exactly two Profile Dimensions, and every member of
those bundles has to be reachable at A2 or the number can never move. That
constraint is what removed Presentation and Academic Discussion; see
[`../adr/0006-confidence-and-presentation-are-not-dimensions.md`](../adr/0006-confidence-and-presentation-are-not-dimensions.md).

| Path | State | Dimensions supplied |
| --- | --- | --- |
| Everyday English *(default)* | Live | Everyday Conversation, Telling Your Story |
| University Success | Live | Classroom Interaction, Explaining Your Work |
| Hospitality & Tourism | Live | Guest Interaction, Complaint Handling |
| Something else *(custom)* | Live | Everyday Conversation, Telling Your Story |
| Job Interview Success | Planned | Interview Readiness, Telling Your Story |
| Study Abroad | Planned | Visa Interview, Travel Navigation |
| Software Engineering | Planned | Technical Explanation, Stand-up Fluency |
| Healthcare | Planned | Patient Communication, Procedure Explanation |

**Everyday English** is the default, for the learner who wants to speak better
without a destination in mind. Without it the Life Path step forces a
commitment that many learners cannot honestly make, and a wrong answer here
skews every session that follows.

**Something else** takes the goal as free text. It is honestly weaker than a
configured path and the UI says so: it inherits Everyday English's
`domain_priority` and template preferences, and the sentence the learner writes
seeds the vocabulary overlay and an LLM-derived context substitution. The
skills underneath are identical — what a custom path lacks is an authored
overlay, not a curriculum.

The four planned paths are visible and disabled rather than hidden. Hiding them
would understate the roadmap; enabling them would generate sessions with no
overlay behind them, which is the kind of prop that collapses under a judge's
follow-up question. A path becomes live when its config file exists — see
`session-engine.md` §7.

## What the assessment must not become

A test with a score at the end. The learner is told it is a conversation, sees
no right answers, and cannot fail it. Placement runs off a global complexity
read — mean sentence length, subordination rate, lexical range, error density —
so there is nothing to pass.

Two honesty rules carry into the reveal screen. Opening numbers are drawn with
a wide uncertainty band, because `evidence_count = 1` means `α = 0.5` and these
estimates will move hard in week one. And a dimension with no evidence reads
"not yet assessed", never 0%.

## Draft state

Everything from steps 2–15 lives in one client-side draft object until
sign-up. It persists locally so a refresh or a closed tab resumes in place.

The custom path's goal text is held in `study_field` rather than a field of its
own, because that is the column it lands in: on every path, step 7 answers "what
is this learner practising for". One field, one meaning, one branch fewer.

On sign-up the draft is replayed to the server in a single call, which creates
the `learner`, the `learner_profile`, and the seeded `learner_competency` rows
from the assessment. Until that endpoint exists the draft is simply the source
the UI renders from.
