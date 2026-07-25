# **AI Communication Coach – Hackathon MVP** 

Vision: Build an AI Communication Coach that helps Ethiopian students and professionals improve real-world spoken English through personalized voice conversations and measurable communication growth. 

# **Core Value** 

Assess → Coach → Practice → Correct → Retry → Measure → Personalize. 

Grounded in three principles from learning science: immediate feedback, metacognition (the learner names their own error), and spaced retrieval in a new context. 

# **Target Persona** 

Primary persona: Hana, an 18-year-old student preparing for university. Secondary persona: Samuel, a graduate preparing for hospitality job interviews. 

# **User Journey** 

Landing Page → Onboarding → Life Path Selection → Communication Assessment → Dashboard → Today's Mission → Live AI Voice Conversation → Reflection → Communication Profile. 

# **Core Screens** 

1. Landing page with one CTA. 

2. Onboarding (native language, Life Path, study field, daily time, feedback language). We never ask the learner to declare their CEFR level. 

3. AI assessment. Four minutes of speech sets the level and seeds the opening profile. 

4. Dashboard with Today's Mission and Communication Rings. 

5. Live voice coaching with transcript. 

6. Reflection and retry. 

7. Communication Profile. 

# **Communication Operating System** 

Underneath, four skill libraries: Vocabulary, Grammar, Pronunciation, Fluency. See AI English Practice Documentation.md. 

On the surface, the Communication Profile shows eight dimensions. Five are fixed for every learner: Grammar, Vocabulary, Pronunciation, Fluency and Confidence. Three are chosen by the learner's Life Path, so Hana sees Presentation, Academic Discussion and Classroom Interaction while Samuel sees Guest Interaction, Complaint Handling and Interview Readiness. 

Each dimension is a named weighted bundle of sub-competency IDs, not a separate score. Every session updates the underlying competencies, and the dimensions are recomputed from them. 

# **AI Brain** 

Speech → dual transcription (Wispr Flow for the live clean transcript, fal Whisper at word chunk level for the verbatim analysis track) → Conversation Director → Context Builder → LLM → Response Validator → English coach voice via fal TTS, Amharic correction voice via Addis AI TTS. 

# **Today's Mission** 

A mission is one themed day of practice: 4 to 6 short activities inside a single story, 20 to 45 minutes depending on level. The learner sees one scene, never a list of exercises. Missions are assembled automatically from the learner's profile by the engine in Session_Generation_Engine.md. 

# **Conversation States** 

The mission arc: Greeting → Warm-up → Vocabulary → Scenario → Challenge → Correction → Retry → Reflection → Summary. 

Each activity inside the arc runs the eight-stage learning loop: Stimulus → Comprehension → Production → Feedback → Retry → Reflection → Store → Spaced Retrieval in a new context. 

# **Motivation** 

No XP, coins, badges or global leaderboards. 

Two separate things, and they should not be confused. Communication **Rings** (Speak, Learn, Improve) track daily activity and weekly consistency. The Communication **Profile** tracks competency growth. Rings are about showing up; the Profile is about getting better. 

# **Tech Stack** 

Next.js, Tailwind CSS, Node.js, PostgreSQL on Render, Addis AI, Wispr Flow, fal, Exa, Firecrawl, Cursor Pro. Every hackathon-provided API has a job: Addis AI for Amharic voice, translation and realtime free talk; Wispr Flow for low-latency live transcription; fal for English text-to-speech, verbatim Whisper analysis and scenario images; Exa and Firecrawl for the Life Path content pipeline; Render for the API, Postgres and cron. See API_Integration_Plan.md for endpoints, reasoning and integration steps. 

# **Demo** 

Show Hana completing one personalized mission, receiving bilingual feedback, retrying successfully, and seeing measurable improvement in her Communication Profile. Then show Day Three, where the same grammar returns inside a different scene and a different activity type because the scheduler predicted she was about to forget it. Nobody wrote Day Three. Full script in Persona.md. 

# **Document Map** 

* Persona.md — the demo narrative and script. 
* AI English Practice Documentation.md — the four competency libraries, the CEFR curriculum, and the 18 exercise templates. 
* Session_Generation_Engine.md — how those three connect, and how a session is generated from a user profile. 
* API_Integration_Plan.md — which hackathon API does what, and how to wire each one. 
* README.md — start here; canonical terminology and build order. 

