# AI Communication Coach — Business Plan

> **Product:** An AI speaking coach that helps Ethiopian students and professionals improve real-world spoken English through personalised voice conversations and bilingual Amharic/English feedback.
>
> **Status:** MVP complete, demo-ready. Needs investment to reach production-grade scale.
>
> **Ask:** Seeking $100,000 for 12 months to ship a subscription product, acquire the first 5,000 paying users, and lock institutional partnerships.

---

## 1. Executive Summary

Ethiopia has 80M+ Amharic speakers entering a economy that demands spoken English — university instruction, hospitality, tech, remote work — but has no structured way to practise speaking it. Every alternative is either unaffordable (private tutors at 500-1,500 ETB/hour), generic (Duolingo, no Amharic feedback), or passive (YouTube).

The AI Communication Coach is the first product that:

1. **Converses in real voice** — not multiple-choice or text
2. **Corrects in Amharic** — the learner hears "I am study" becomes "I am studying" explained in their own language
3. **Remembers what you forgot** — spaced retrieval returns a weakness days later in a new context
4. **Measures what moved** — word-level analysis from Whisper timestamps drives a six-dimension Communication Profile with real numbers, not LLM guesses

**Revenue model:** 1,000 ETB/month (~$13 USD) unlimited subscription — aggressively priced at roughly 1/10th the cost of a single hour of tutoring.

**Target:** 5,000 paying users by month 12 → ~$780,000 ARR, 30,000 by month 24.

---

## 2. The Problem & Market

### 2.1 The English-Speaking Gap

Ethiopia's higher education system and professional service sector operate in English, but most students arrive at university having only read and written it. Their speaking confidence lags dramatically behind their reading comprehension — an A2-level disparity that shuts them out of class participation, job interviews, and remote work opportunities.

| Problem | Evidence |
|---|---|
| University instruction is in English | All 50+ public universities teach in English |
| Speaking assessed in every course | Presentations, defences, viva exams |
| No structured speaking practice | Tutors exist, but cost prohibitive for most |
| Amharic-English interference predictable | Pronunciation, grammar, fluency all affected |

### 2.2 Market Sizing

**TAM — Total Addressable Market**

| Segment | Population | Est. users |
|---|---|---|
| Ethiopian university students | ~1.2M enrolled | 800,000 |
| Ethiopian professionals (hospitality, tech, govt) | ~2M | 600,000 |
| Ethiopian diaspora families (English learners) | ~2M diaspora | 400,000 |
| Ethiopian secondary students (pre-university) | ~5M | 600,000 |
| **TAM** | | **~2.4M** |

**SAM — Serviceable Available Market** (smartphone owners with internet)

- Smartphone penetration in urban Ethiopia: ~45%
- Mobile internet users: ~25M
- English learners on mobile: ~5M
- **SAM: ~2M users**

**SOM — Serviceable Obtainable Market** (first 3 years)

- Year 1: 5,000 paying users
- Year 2: 20,000 paying users
- Year 3: 60,000 paying users

### 2.3 What Currently Exists

| Alternative | Cost | Amharic feedback | Voice practice | Spaced retrieval | Measured progress |
|---|---|---|---|---|---|
| Private tutor | 500-1,500 ETB/hr | Sometimes | Yes | No | Subjective |
| Duolingo | ~1,000 ETB/yr | Text only | Limited | No | Gamified |
| ELSA Speak | ~1,500 ETB/yr | No | Yes | No | Pronunciation only |
| YouTube channels | Free | Some | Passive | No | None |
| Telegram practice groups | Free | Peer | Limited | No | None |
| **AI Communication Coach** | **1,000 ETB/mo** | **Yes, native Amharic voice** | **Full voice conversations** | **Yes, Day Three** | **6 dimensions, real metrics** |

---

## 3. Product & Technology

### 3.1 The Core Loop

```
Assess → Coach → Practice → Correct → Retry → Measure → Personalise
```

Every session runs this loop. The learner speaks, the coach listens, an error is caught, the learner names it and retries, and the Communication Profile updates in real time.

### 3.2 The Bilingual Voice Pipeline

| Layer | Provider | Role | Cost Factor |
|---|---|---|---|
| Conversation Director | Gemini 2.5 Flash | Driving the coaching dialogue | $0.15/1M input tokens |
| Grading Engine | Gemini 2.5 Pro | Structured competency judgement | $0.75/1M input tokens |
| English TTS | ElevenLabs (via fal) | Coach's English voice | ~$0.009/session |
| Amharic TTS | Addis AI | Bilingual correction — Amharic explanation | ~$0.005/session |
| Live transcript | Wispr Flow | On-screen caption during conversation | Per-user monthly |
| Word analysis | Whisper (fal) | Word-level timestamps for fluency/delivery metrics | ~$0.006/session |

### 3.3 Defensible Features

No competitor combines all four:

1. **Bilingual feedback in Amharic voice** — learners hear corrections explained in their mother tongue
2. **Word-level measurement** — Whisper timestamps drive real numbers (pause ratio, hesitation rate, speech rate) for the Communication Profile
3. **Spaced retrieval with context change** — a competency is reviewed days later in a *different* scene, which is what drives long-term transfer
4. **Life Path skinning** — the same curriculum serves a university student and a hotel front-desk worker differently without a second content library

### 3.4 Current State

| Layer | Status |
|---|---|
| Core AI pipeline (Gemini + ElevenLabs + Whisper) | Built and wired |
| Session engine (scoring, scheduling, mastery) | Built with tests |
| Database schema (21 models, full Prisma) | Built |
| Client pages (Landing, Onboarding, Plan, Practice) | Built |
| Curriculum seed data | Seeded for demo |
| **Auth & payments** | **Not built — stubs** |
| **Full 29-domain content** | **Demo slice only** |
| **Mobile optimization** | **Responsive but incomplete** |
| **Institutional features** | **Not built** |

---

## 4. Subscription Model

### 4.1 Tier Structure

| Tier | Price | Sessions/month | Who it serves |
|---|---|---|---|
| **Free** | 0 ETB | 15 | Discovery — experience the coach, hear Amharic feedback, see your Profile move once |
| **Weekly** | 300 ETB | 30 | Casual learners — 5-7 minutes/day, keep a streak without commitment |
| **Monthly** | **1,000 ETB** | **Unlimited** | **Core product** — daily practice, spaced retrieval, full Profile tracking |
| **Annual** | 8,000 ETB | Unlimited | Committed users — two months free, best LTV |
| **Institutional** | Custom | Per-seat | Universities buying for departments, hotels for staff — negotiated per cohort |

### 4.2 Why 1,000 ETB

The question every stakeholder — investor, partner, customer — will ask: *"1,000 ETB is a lot. Justify it."*

Here is the answer, in five independent arguments.

---

**Argument 1 — Cost per session: cheaper than an SMS**

At 1,000 ETB for unlimited sessions, a user practising daily does 60-100 sessions/month.

| Usage | Sessions | Cost per session |
|---|---|---|
| Light | 30 | 33 ETB |
| Moderate | 60 | 17 ETB |
| Heavy | 100 | **10 ETB** |

**10 ETB per session** is less than a single SMS (1.84 ETB × 6 messages), less than a bus fare across Addis (~10-15 ETB), less than a banana and a juice at a cafeteria (~25-30 ETB).

The price per minute of practice: at 5-7 minutes per session, 100 sessions = ~500-700 minutes of 1-on-1 coaching. That is **1.4-2 ETB per minute** — cheaper than a phone call.

---

**Argument 2 — Value anchor: 1/100th the cost of a tutor**

| Service | Price | What you get |
|---|---|---|
| Private tutor (1 hour) | 500-1,500 ETB | 1 session, subjective feedback, scheduling friction |
| Your app (1 month) | **1,000 ETB** | **80-100 sessions, measured progress, anytime, anywhere** |

**One hour with a tutor costs as much as 1-3 months of unlimited AI coaching.**

The ratio is even starker for the learner who needs daily practice. A student who practises 5 days/week gets ~20 sessions with a tutor in a month at **10,000-30,000 ETB**, or **100 sessions with the coach at 1,000 ETB**.

The coach delivers 5-20x more practice at 1/10th the price.

---

**Argument 3 — The premium positioning is intentional**

| Product | Price/month | Category |
|---|---|---|
| Telegram Premium | ~80 ETB | Communication |
| Mobile data (5GB) | ~200 ETB | Utility |
| Netflix Mobile | ~300-400 ETB | Entertainment |
| Textbook (one-time) | 300-800 ETB | Education |
| **AI Communication Coach** | **1,000 ETB** | **Career investment** |

At 1,000 ETB, the coach is positioned as a **career investment**, not an entertainment expense. A student serious about their future spends 3x on data and 2x on transportation every month already. The coach sits alongside those costs because it directly impacts their earning potential.

**For comparison:** A hotel front-desk agent earning 8,000-15,000 ETB/month who moves to a better role because their English improved gets an ROI of **5-15x in the first paycheck alone**.

---

**Argument 4 — The technology justifies the price**

No competitor at *any* price point offers this combination:

- **Real voice conversation** (not text chat or multiple choice)
- **Bilingual Amharic voice correction** (not English-only feedback)
- **Word-level measurement** from Whisper timestamps driving a real Profile
- **Spaced retrieval in a new context** (the Day Three beat — the hardest technical claim)

Building these features requires Gemini Pro, ElevenLabs, Addis AI, and fal — each with real API costs. At 100 sessions/month, the **API bill alone is ~$2.00 (150 ETB)** per user. The 1,000 ETB price leaves room for:

- API costs (150 ETB)
- Payment processing (~30 ETB via Chapa/Telebirr)
- Infrastructure & hosting (~50 ETB)
- Customer support & operations (~70 ETB)
- **Gross margin: ~700 ETB (70%)**

---

**Argument 5 — Anchoring makes the weekly and annual tiers convert better**

- **Weekly at 300 ETB** — feels cheap next to 1,000 ETB, converts curious users
- **Monthly at 1,000 ETB** — the anchor
- **Annual at 8,000 ETB** — "only 667 ETB/month" is a 33% discount that drives annual commitment and lowers churn

Free (15 sessions) → user hears their first Amharic correction → Weekly (30 sessions) → they see their Profile move → Monthly (unlimited) — the natural progression.

### 4.3 Payment Infrastructure (Ethiopia-Specific)

| Method | Integration | Fee |
|---|---|---|
| Telebirr | Chapa API | ~2.5% |
| Chapa Checkout | Direct API | ~3.5% |
| Mobile banking | CBE Birr, Awash, Dashen | ~1-2% |
| Bank transfer (institutional) | Manual invoice | Minimal |

Primary: Telebirr via Chapa. Secondary: Direct bank for institutional bulk buys.

---

## 5. Unit Economics

### 5.1 Cost Per Session

| Service | Usage Per Session | Unit Cost | Cost/Session |
|---|---|---|---|
| Gemini Flash (dialogue) | ~3,000 input tokens | $0.15/1M input | $0.0005 |
| Gemini Pro (grading) | ~2,000 input tokens | $0.75/1M input | $0.0015 |
| ElevenLabs TTS | ~30,000 characters | $0.30/1K chars | $0.0090 |
| Addis AI TTS | ~15,000 characters | $0.032/min | $0.0030 |
| Wispr Flow | 1 session | Flat/user | $0.0025 |
| Whisper (fal) | ~60 seconds audio | $0.006/sec | $0.0060 |
| Render hosting (amortized) | — | Monthly/active user | $0.0030 |
| **Total** | | | **~$0.0255** |

### 5.2 Margin Per Tier (at average usage)

| Tier | Price ($) | Price (ETB) | Avg sessions | Cost ($) | Gross profit ($) | GM% |
|---|---|---|---|---|---|---|
| Free | $0 | 0 ETB | 15 | $0.38 | -$0.38 | — |
| Weekly | $3.90 | 300 ETB | 30 | $0.77 | $3.13 | **80%** |
| **Monthly** | **$13.00** | **1,000 ETB** | **75** | **$1.91** | **$11.09** | **85%** |
| Annual (monthly equiv) | $8.67 | 667 ETB | 75 | $1.91 | $6.76 | **78%** |
| Institutional | $2.60-5.20 | 200-400 ETB | 50 | $1.28 | $1.32-3.92 | **50-75%** |

### 5.3 Blended P&L — Month 12 (5,000 total users, 30% paid)

| Metric | Value |
|---|---|
| Total users | 5,000 |
| Free (70%) | 3,500 |
| Weekly (10%) | 500 |
| Monthly (15%) | 750 |
| Annual (5%) | 250 |
| Monthly revenue | ~$16,250 (~1.25M ETB) |
| Monthly API & infra cost | ~$3,200 |
| Payment processing fees | ~$570 |
| **Monthly gross profit** | **~$12,480** **(77%)** |
| Monthly burn (team + ops) | ~$8,000 |
| **Monthly net cash flow** | **~$4,480** |

### 5.4 Path to Unit Profitability Per User

| Metric | Value |
|---|---|
| CAC (paid acquisition) | ~$3.00 (230 ETB) — Telebirr ads, campus ambassadors |
| Average monthly revenue per paid user (ARPU) | ~$10.83 (833 ETB) |
| Monthly cost per paid user | ~$1.82 (140 ETB) |
| Gross margin per paid user per month | ~$9.01 (693 ETB) |
| Months to recover CAC | < 1 month |
| Estimated monthly churn | 8-12% |
| Customer lifetime (months) | 10-12 months |
| **LTV** | **~$100-130** **(7,700-10,000 ETB)** |
| LTV/CAC ratio | **33:1 — capital efficient** |

---

## 6. Investment Ask

### 6.1 The Ask

We are raising **$100,000** to take the AI Communication Coach from an MVP to a production-grade, revenue-generating product with 5,000 paying users within 12 months.

### 6.2 What The Money Funds

| Item | Amount | % | Detail |
|---|---|---|---|
| **Engineering (senior full-stack dev)** | $45,000 | 45% | 12 months — auth/payments system, content expansion beyond demo slice, mobile optimization, offline support, institutional dashboard |
| **API pre-paid credits & infra** | $25,000 | 25% | Gemini, ElevenLabs, Addis AI, fal credits at negotiated bulk rates; Render Pro infrastructure; database scaling |
| **Marketing & user acquisition** | $15,000 | 15% | Telebirr advertising, campus ambassador programme (10 universities), referral incentives, content marketing |
| **Operations & compliance** | $10,000 | 10% | Legal (entity registration in Ethiopia, terms of service, data privacy), Chapa/Telebirr integration, accounting, customer support (1 part-time) |
| **Infrastructure & tooling** | $5,000 | 5% | CDN, monitoring, CI/CD, backup systems, emergency API credits |

### 6.3 Why Investment Is Needed — MVP vs Production

The MVP is real and working. But there is a canyon between "works in a demo" and "works for 5,000 paying Ethiopian users." Here is what the investment bridges:

**1. Auth, payments & billing (currently stubs)**

The sign-up screen collects an email and does nothing. Production needs:
- Telebirr + Chapa payment integration with idempotent billing
- Subscription lifecycle (trial → active → expired → reactivated)
- Invoice generation for institutional bulk buyers
- Reconciliation for mobile money (which is different from card payments)

**2. Full content (currently demo slice)**

The MVP has 1 domain (A2-D01), 3 templates, and 1 Life Path. Production needs:
- 29 domains across A2-C2 (6 CEFR levels × 5-6 domains each) — hundreds of competencies
- 15 exercise templates fully authored with stimulus pools
- 4 Life Paths (University, Hospitality, Tech, Professional) at minimum
- Automated content pipeline (Exa + Firecrawl → LLM → stimulus pool) running nightly

**3. Infrastructure at scale (currently Render free tier)**

The MVP runs on a single process that cold-starts in 15 seconds. Production needs:
- Autoscaling web services
- CDN for audio assets
- Database connection pooling and read replicas
- Monitoring, alerting, and incident response

**4. Mobile + offline (currently web-only with rough mobile)**

Most users access the internet on mobile phones, and connectivity is unreliable. Production needs:
- Progressive Web App with offline-capable sessions
- Audio download for replay without streaming
- Data-efficient mode (lower bitrate audio)
- SMS fallback for session reminders

**5. Institutional sales capability**

The highest-value channel is universities buying bulk seats. Production needs:
- Admin dashboard for cohort management
- Bulk invoicing and payment
- Progress reporting per student
- Privacy compliance for student data

### 6.4 Milestones

| Month | Milestone | Metric |
|---|---|---|
| 1-2 | Auth, payments, Telebirr integration live | In-app subscription purchase works |
| 2-3 | Content expansion to 5 domains, 8 templates | More sessions per user possible |
| 3-4 | Marketing launch — campus ambassadors at 5 universities | 500 paid users |
| 4-5 | Mobile PWA + data-efficient mode | 80%+ sessions on mobile |
| 6 | Institutional dashboard v1 | 2 university pilot partnerships |
| 6-8 | Full 29-domain curriculum | All CEFR bands covered |
| 9-12 | Scale to 5,000 paid users | Revenue: ~$16,250/mo |
| 12-18 | Ethiopian diaspora launch (USD pricing) | +2,000 paid users |
| 18-24 | Other Ethiopian languages (Afan Oromo, Tigrinya) | +10,000 paid users |

### 6.5 Use of Funds Trajectory

```
Month   Spend    Revenue    Users (paid)    Cumulative
1       $15K     $0         0               -$15K
3       $35K     $5K        300             -$55K
6       $60K     $30K       1,800           -$100K
9       $80K     $75K       4,600           -$110K
12      $100K    $195K      12,000          -$28K
15      $120K    $390K      24,000          +$140K
```

Breakeven: Month 13.

### 6.6 Risk & Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Telebirr/Chapa payment failures | Medium | High | Multiple payment providers, SMS fallback for payment links |
| Low willingness to pay | Low | Critical | Free tier drives conversion; 300 ETB weekly tier for price-sensitive users; institutional bulk discounts |
| API cost overrun at scale | Low | Medium | ElevenLabs and Gemini negotiate volume discounts; we can switch TTS models |
| Competitor copies core loop | Medium | Medium | Bilingual Amharic feedback is a moat — Addis AI is the only quality Amharic TTS; 1+ year head start on content |
| Connectivity issues | Medium | Medium | Offline mode, data-efficient audio, SMS reminders |
| User retention below projection | Medium | High | Spaced retrieval is retention — Day Three moment proves it; referral incentives for social retention |

### 6.7 Competitive Moat

1. **Amharic TTS quality** — Addis AI is the only provider with native-quality Amharic voice. A competitor would need the same integration or build their own.
2. **Word-level measurement pipeline** — Wispr Flow + Whisper dual transcription is an architectural choice, not a feature toggle. Copying it requires rebuilding from scratch.
3. **Curriculum + content** — 29 domains, 15 templates, 4 Life Paths, all authored and seedable. Content is the long-term moat.
4. **Spaced retrieval engine** — Mastery + retrievability + stability + template-variety penalty. The Day Three moment is ~40 lines of code that require the entire data model underneath.
5. **Learning data** — Every session writes to the learner model. After 6 months of usage, the data moat makes switching costly for the user.

---

## 7. Growth & Traction Plan

### 7.1 Phase 1: Direct-to-Consumer (Months 1-6)

**Channel:** Telebirr ads, campus ambassadors, referral programme
**Target:** 1,000 paid users
**Cost:** ~$5,000

| University | Location | Est. students | Target |
|---|---|---|---|
| Addis Ababa University | Addis Ababa | 50,000 | 300 |
| Bahir Dar University | Bahir Dar | 30,000 | 150 |
| Hawassa University | Hawassa | 25,000 | 100 |
| Mekelle University | Mekelle | 20,000 | 100 |
| Jimma University | Jimma | 30,000 | 150 |
| Others | Various | — | 200 |
| **Total** | | | **1,000** |

**Tactic:** Campus ambassadors (students who get 1 month free for every 5 referrals they convert).

**Cost per acquisition (CAC):** ~$3 (230 ETB) — ambassador commission + Telebirr ad spend per conversion.

### 7.2 Phase 2: Institutional (Months 4-12)

**Channel:** Direct B2B sales to universities and hospitality chains
**Target:** 10 institutional clients → ~3,000 paid seats
**Price:** 200-400 ETB/seat/month (bulk discount)

| Client type | Est. seats | Price/seat | Monthly rev |
|---|---|---|---|
| University department | 200-500 | 300 ETB | 60K-150K ETB |
| Hotel chain (Sheraton, Marriott, local chains) | 50-200 | 400 ETB | 20K-80K ETB |
| NGO / training programme | 50-100 | 200 ETB | 10K-20K ETB |

### 7.3 Phase 3: Ethiopian Diaspora (Months 12-18)

**Channel:** Social media (diaspora Facebook groups, TikTok), diaspora associations
**Target:** 2,000 paying users
**Price:** $9.99/month (USD) — international pricing for diaspora with Western incomes

### 7.4 Phase 4: Language Expansion (Months 18-24)

**Channel:** Existing users, word-of-mouth
**Addition:** Afan Oromo and Tigrinya feedback voices via Addis AI as they expand language support
**Target:** +10,000 users across Ethiopia and diaspora

---

## 8. Financial Projections

### 8.1 12-Month Projection (Conservative)

| Month | Free | Weekly | Monthly | Annual | Total Paid | Revenue ($) | Revenue (ETB) |
|---|---|---|---|---|---|---|---|
| 1 | 200 | 10 | 5 | 0 | 15 | $90 | 6,900 |
| 2 | 500 | 25 | 15 | 5 | 45 | $313 | 24,000 |
| 3 | 1,000 | 50 | 40 | 10 | 100 | $765 | 59,000 |
| 4 | 2,000 | 100 | 80 | 20 | 200 | $1,530 | 118,000 |
| 5 | 3,000 | 150 | 150 | 30 | 330 | $2,525 | 194,000 |
| 6 | 4,000 | 200 | 300 | 50 | 550 | $4,735 | 364,000 |
| 7 | 5,000 | 250 | 450 | 75 | 775 | $7,005 | 539,000 |
| 8 | 6,000 | 300 | 600 | 100 | 1,000 | $9,010 | 693,000 |
| 9 | 7,000 | 350 | 750 | 125 | 1,225 | $11,100 | 854,000 |
| 10 | 8,000 | 400 | 900 | 150 | 1,450 | $13,190 | 1,015,000 |
| 11 | 9,000 | 450 | 1,050 | 175 | 1,675 | $15,280 | 1,176,000 |
| **12** | **10,000** | **500** | **1,200** | **200** | **1,900** | **$17,370** | **1,337,000** |

**Year 1 revenue: ~$82,000 (~6.3M ETB)**

### 8.2 24-Month Projection

| Metric | Year 1 | Year 2 |
|---|---|---|
| Total users | 10,000 | 40,000 |
| Paid users | 1,900 | 12,000 |
| Monthly revenue (end of year) | $17,370 | $104,000 |
| Annual revenue | $82,000 | $728,000 |
| Gross margin | 75% | 82% |
| Team size | 2 | 5 |
| Annual burn | $100,000 | $240,000 |
| **Net cash flow** | **-$18,000** | **+$488,000** |

---

## 9. Team

### Current

- **Founder/Engineer** — Built the full MVP frontend-to-backend (Next.js, Node, Prisma, Gemini, ElevenLabs, Addis AI integration). Shipping product is a core competency.

### To hire with investment

| Role | Timeline | Cost (12 months) |
|---|---|---|
| Senior full-stack engineer | Month 1 | $35,000 (contract in Ethiopia/local) |
| Part-time marketing / campus ops | Month 3 | $8,000 |
| Customer support / content author | Month 4 | $6,000 |
| Part-time financial ops (Chapa reconciliation) | Month 4 | $6,000 |

---

## 10. Why Now

1. **Mobile money is mature enough.** Telebirr has 40M+ users, Chapa provides a developer-friendly API. Payments were a blocker three years ago and are now solvable.

2. **AI API costs have collapsed.** Gemini 2.5 Flash at $0.15/1M tokens makes real-time coaching economically viable. Even six months ago this was 5x more expensive.

3. **Addis AI exists.** Native-quality Amharic TTS and LLM — the bilingual feedback that is the product's emotional centre — did not exist before 2024.

4. **Ethiopia's English demand is accelerating.** Remote work, tourism recovery, university expansion — the need for spoken English is growing faster than the supply of tutors.

5. **No competitor owns this space.** International apps ignore Ethiopian languages. Local EdTech is focused on exam prep (textbook digitisation), not speaking. The window is open.

---

## 11. The Ask (Recap)

| Item | Detail |
|---|---|
| **Amount** | **$100,000** |
| **Instrument** | Equity (negotiable) or convertible note with standard terms |
| **Use** | Engineering ($45K), API/infra ($25K), marketing ($15K), ops ($10K), tooling ($5K) |
| **Milestone at funding** | 5,000 paid users, $200K+ ARR, institutional channel proven |
| **Target close** | Q4 2026 |
| **Contact** | [Your name / email] |

---

## Appendix A: Competency Library Structure (Sample)

| ID | Competency | Skill | Domain | Sessions to initial mastery |
|---|---|---|---|---|
| G001.01 | Subject-verb agreement (be) | Grammar | A2-D01 | 3-5 |
| G006.01 | Present continuous vs simple present | Grammar | A2-D01 | 5-8 |
| V001.05 | Greetings and introductions vocabulary | Vocabulary | A2-D01 | 2-3 |
| P001.02 | /θ/ and /ð/ (voiced/unvoiced "th") | Pronunciation | A2-D01 | 5-10 |
| F002.03 | Turn length >15 seconds | Fluency | A2-D01 | 5-8 |

Full curriculum: `docs/curriculum/`

## Appendix B: Cost-per-Session Sensitivity

| Scenario | Sessions/mo | API Cost | Cost/Session | Margin at 1,000 ETB |
|---|---|---|---|---|
| Light user | 30 | $0.77 | $0.026 | 92% |
| Moderate | 60 | $1.53 | $0.026 | 86% |
| Heavy user | 100 | $2.55 | $0.026 | 81% |
| Power user | 150 | $3.83 | $0.026 | 74% |

The cost-per-session is essentially linear (API costs are usage-based). The subscription model works because heavy users are a small fraction of the base and the margin even on power users remains healthy.

---

*Document version 1.0 — Prepared for investor conversations. All financial projections are estimates based on current API pricing as of mid-2026 and should be stress-tested with actual usage data post-launch.*
