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
| 3 | Native language | L1 | `l1` | `l1_risk` contributes 10% of competency priority. Amharic promotes `/p/`–`/b/`, `/v/`–`/b/`, cluster epenthesis, `/θ/`–`/ð/`. Also sets the default for step 7. |
| 4 | Life Path | why they are here | `life_path_id` | The largest single lever: `domain_priority`, `context_substitutions`, `vocabulary_overlay`, `template_preference`, and three of the eight Profile Dimensions. |
| 5 | Field or role | study field | `study_field` | Seeds vocabulary overlay and stimulus themes. The question text is conditioned on step 4 — a course for university, a target role for hospitality. |
| 6 | Daily time | minutes per day | `daily_minutes` | Selects the `LOAD_TABLE` row: session count, new-concept and review split. |
| 7 | Feedback language | correction language | `feedback_language` | English-only, or bilingual corrections spoken by Addis AI TTS. |
| 8 | Goal date *(skippable)* | deadline | `goal_date` | Framing today, priority weighting later. The only optional question. |
| 9 | Mic check | — | — | Permission and a live level read, before it can fail mid-assessment. |
| 10 | Assessment intro | — | — | Sets the expectation: a conversation, not a test. |
| 11 | `EX001` Picture description | speech | — | Vocabulary, Grammar, baseline delivery metrics. |
| 12 | `EX007` Personal questions | speech | — | Fluency, response latency, Confidence. |
| 13 | `EX009` Personal experience | speech | — | Narrative tense control, sentence length, Storytelling. |
| 14 | Profile reveal | — | `cefr` | Placement from the global complexity read; seeding at `evidence_count = 1`. |
| 15 | First mission | — | — | The existing practice screen. |
| 16 | Sign-up | email | — | Attaches everything above to a real account. |

Steps 1–8 are roughly ninety seconds. Steps 11–13 are about four minutes of
speech in total. The demo script budgets thirty seconds for the questions and
sixty for the assessment, so both are cut for time on stage — see the script at
the end of `persona.md`.

## Why one question per screen

The onboarding is the learner's first conversation with the coach, so it is
staged as one: the orb is present on every step, the question reads as
something it asked, and the answer is the learner's turn. A seven-field form
would collect the same data and teach the learner nothing about what the
product is.

It also keeps each answer cheap to revise. Back never loses work.

## Life Paths

Six paths are shown because six paths are the product's argument — the learner
chooses *why*, not what level. Two are configured today:

| Path | State | Dimensions supplied |
| --- | --- | --- |
| University Success | Live | Presentation, Academic Discussion, Classroom Interaction |
| Hospitality & Tourism | Live | Guest Interaction, Complaint Handling, Interview Readiness |
| Job Interview Success | Planned | reuses `interview_readiness` |
| Study Abroad | Planned | — |
| Software Engineering | Planned | — |
| Healthcare | Planned | — |

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

Everything from steps 2–14 lives in one client-side draft object until
sign-up. It persists locally so a refresh or a closed tab resumes in place.

On sign-up the draft is replayed to the server in a single call, which creates
the `learner`, the `learner_profile`, and the seeded `learner_competency` rows
from the assessment. Until that endpoint exists the draft is simply the source
the UI renders from.
