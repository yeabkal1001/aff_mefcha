# Authored Content Pack - A2-D01


This is the seed data for the demo slice. Everything here is authored content, not code; it is the complete content dependency for Hana's journey. The schemas are defined in [`../architecture/session-engine.md`](../architecture/session-engine.md), sections 3 and 5.

The rest of the library still needs this treatment before the product ships. This pack covers the fifteen sub-competencies and three templates the demo actually exercises: `V001.01`, `V001.03`, `V001.05`, `V003.01`, `G001.01`, `G001.05`, `G003.01`, `G005.01`, `G005.04`, `G006.01`, `G006.05`, `P001.08`, `P005.01`, `F002.01`, `F003.01`, plus `EX001`, `EX007` and `EX018`.

## A.1 — Competency records

```json
[
  { "id": "V001.01", "parent": "V001", "name": "Name & Identity", "skill": "vocabulary",
    "cefr_min": "A2", "cefr_max": "B1", "prerequisites": [], "observable": true,
    "elicitation_cues": ["introducing yourself to a group", "meeting someone for the first time"],
    "success_criteria": "States own name clearly and can spell or repeat it on request.",
    "common_errors": [{ "wrong": "My name is called Hana", "right": "My name is Hana", "tag": "redundant_called" }] },

  { "id": "V001.03", "parent": "V001", "name": "Nationality", "skill": "vocabulary",
    "cefr_min": "A2", "cefr_max": "B1", "prerequisites": ["V001.01"], "observable": true,
    "elicitation_cues": ["saying where you are from", "describing your home city"],
    "success_criteria": "Uses the correct nationality adjective and distinguishes it from the country noun.",
    "common_errors": [{ "wrong": "I am from Ethiopian", "right": "I am from Ethiopia", "tag": "country_adjective_confusion" },
                      { "wrong": "I am Ethiopia", "right": "I am Ethiopian", "tag": "country_adjective_confusion" }] },

  { "id": "V001.05", "parent": "V001", "name": "Occupation", "skill": "vocabulary",
    "cefr_min": "A2", "cefr_max": "C1", "prerequisites": ["V001.01"], "observable": true,
    "elicitation_cues": ["saying what you do or study", "explaining your field to a stranger"],
    "success_criteria": "Names field of work or study using topic-appropriate vocabulary.",
    "common_errors": [{ "wrong": "I am student of computer", "right": "I am a computer science student", "tag": "missing_article_field" }] },

  { "id": "V003.01", "parent": "V003", "name": "Morning Routine", "skill": "vocabulary",
    "cefr_min": "A2", "cefr_max": "B1", "prerequisites": [], "observable": true,
    "elicitation_cues": ["describing what you do before class", "a photo of someone getting ready"],
    "success_criteria": "Sequences at least three morning activities using appropriate verbs.",
    "common_errors": [{ "wrong": "I make shower", "right": "I take a shower", "tag": "collocation_make_take" }] },

  { "id": "G001.01", "parent": "G001", "name": "Affirmative Forms", "skill": "grammar",
    "cefr_min": "A2", "cefr_max": "B1", "prerequisites": [], "observable": true,
    "elicitation_cues": ["stating who you are", "describing a person in a photograph"],
    "success_criteria": "Selects am, is, or are correctly for the subject.",
    "common_errors": [{ "wrong": "I is a student", "right": "I am a student", "tag": "be_agreement" },
                      { "wrong": "She are my friend", "right": "She is my friend", "tag": "be_agreement" }],
    "l1_risk": { "am": 0.4 } },

  { "id": "G001.05", "parent": "G001", "name": "Identity & Description", "skill": "grammar",
    "cefr_min": "A2", "cefr_max": "B1", "prerequisites": ["G001.01"], "observable": true,
    "elicitation_cues": ["introducing yourself with two facts", "describing someone's role"],
    "success_criteria": "Combines be with a noun phrase or adjective to state identity or quality.",
    "common_errors": [{ "wrong": "I student", "right": "I am a student", "tag": "copula_omission" }],
    "l1_risk": { "am": 0.6 } },

  { "id": "G003.01", "parent": "G003", "name": "Subject Pronouns", "skill": "grammar",
    "cefr_min": "A2", "cefr_max": "B1", "prerequisites": [], "observable": true,
    "elicitation_cues": ["referring back to a person already mentioned"],
    "success_criteria": "Substitutes the correct subject pronoun without repeating the noun.",
    "common_errors": [{ "wrong": "My brother, my brother works", "right": "My brother, he works", "tag": "noun_repetition" },
                      { "wrong": "He is my sister", "right": "She is my sister", "tag": "gender_confusion" }],
    "l1_risk": { "am": 0.5 } },

  { "id": "G005.01", "parent": "G005", "name": "Affirmative", "skill": "grammar",
    "cefr_min": "A2", "cefr_max": "B2", "prerequisites": ["G001.01"], "observable": true,
    "elicitation_cues": ["describing a habit", "saying what you do every day"],
    "success_criteria": "Uses the base verb form for I, you, we, they.",
    "common_errors": [{ "wrong": "I studying every day", "right": "I study every day", "tag": "tense_substitution" }] },

  { "id": "G005.04", "parent": "G005", "name": "Third Person Singular", "skill": "grammar",
    "cefr_min": "A2", "cefr_max": "B2", "prerequisites": ["G005.01"], "observable": true,
    "elicitation_cues": ["describing what another person does", "a photo of one person working"],
    "success_criteria": "Adds -s or -es to the verb for he, she, it.",
    "common_errors": [{ "wrong": "He work at the hotel", "right": "He works at the hotel", "tag": "missing_third_person_s" }],
    "l1_risk": { "am": 0.8 } },

  { "id": "G006.01", "parent": "G006", "name": "Actions Happening Now", "skill": "grammar",
    "cefr_min": "A2", "cefr_max": "B2", "prerequisites": ["G005.01", "G001.01"], "observable": true,
    "elicitation_cues": ["describing a photograph of an action in progress",
                         "answering what is happening right now"],
    "success_criteria": "Uses be plus present participle for actions in progress; does not substitute bare present simple.",
    "common_errors": [{ "wrong": "I am study software engineering", "right": "I am studying software engineering", "tag": "missing_participle" },
                      { "wrong": "I study now", "right": "I am studying now", "tag": "tense_substitution" }],
    "l1_risk": { "am": 0.7 } },

  { "id": "G006.05", "parent": "G006", "name": "Contrast with Present Simple", "skill": "grammar",
    "cefr_min": "A2", "cefr_max": "B2", "prerequisites": ["G006.01", "G005.05"], "observable": true,
    "elicitation_cues": ["comparing a habit with what is happening today"],
    "success_criteria": "Selects simple for habits and continuous for the current moment within one turn.",
    "common_errors": [{ "wrong": "Every day I am going to class", "right": "Every day I go to class", "tag": "continuous_for_habit" }],
    "l1_risk": { "am": 0.7 } },

  { "id": "P005.01", "parent": "P005", "name": "Primary Stress", "skill": "pronunciation",
    "cefr_min": "A2", "cefr_max": "C1", "prerequisites": [], "observable": true,
    "elicitation_cues": ["naming a multi-syllable field of study", "saying a long topic word in a sentence"],
    "success_criteria": "Places primary stress on the correct syllable in target multi-syllable words.",
    "common_errors": [{ "wrong": "engiNEEring stressed as ENgineering", "right": "engiNEERing", "tag": "stress_shift_left" },
                      { "wrong": "COMputer stressed as compuTER", "right": "comPUter", "tag": "stress_shift_right" }],
    "l1_risk": { "am": 0.6 },
    "measurement": "syllable-nucleus duration and relative energy from fal Whisper word timestamps" },

  { "id": "P001.08", "parent": "P001", "name": "Common L1 Sound Confusions", "skill": "pronunciation",
    "cefr_min": "A2", "cefr_max": "C2", "prerequisites": [], "observable": true,
    "elicitation_cues": ["minimal-pair drill on the learner's L1 risk set"],
    "success_criteria": "Produces the target sound distinctly enough that transcription recovers the intended word.",
    "l1_confusions": { "am": [
      { "pair": ["/p/", "/b/"], "words": ["programming / bro gramming", "present / besent"], "risk": 0.8 },
      { "pair": ["/v/", "/b/"], "words": ["very / berry"], "risk": 0.7 },
      { "cluster": "initial consonant clusters", "note": "epenthetic vowel inserted, e.g. school as isukul", "risk": 0.6 }
    ] },
    "measurement": "minimal-pair proxy: if the transcriber returns the contrast word, score the target as missed" },

  { "id": "F002.01", "parent": "F002", "name": "Describe People", "skill": "fluency",
    "cefr_min": "A2", "cefr_max": "C2", "prerequisites": [], "observable": true,
    "elicitation_cues": ["describing yourself to a group", "describing a person in an image"],
    "success_criteria": "Produces at least three connected sentences about a person without prompting.",
    "common_errors": [{ "wrong": "single-sentence answer then silence", "right": "three or more connected sentences", "tag": "underproduction" }] },

  { "id": "F003.01", "parent": "F003", "name": "Personal Questions", "skill": "fluency",
    "cefr_min": "A2", "cefr_max": "C2", "prerequisites": [], "observable": true,
    "elicitation_cues": ["direct question about the learner's life"],
    "success_criteria": "Answers within four seconds with a complete clause rather than a single word.",
    "common_errors": [{ "wrong": "long silence then one word", "right": "a full-clause answer", "tag": "latency_underproduction" }],
    "measurement": "response latency and clause count from the verbatim transcript" }
]
```

## A.2 — Template descriptors

```json
[
  { "id": "EX001", "name": "Picture Description", "family": "observation_description",
    "stimulus_type": "image", "interaction_mode": "monologue",
    "cefr_min": "A2", "cefr_max": "C1", "duration_minutes": [3, 6],
    "requires_fluency": [],
    "measures": { "vocabulary": 0.90, "grammar": 0.75, "pronunciation": 0.40, "fluency": 0.80 },
    "elicits": [
      { "competency": "V*", "strength": 0.9, "note": "topic vocabulary follows the image subject" },
      { "competency": "G002", "strength": 0.9 },
      { "competency": "G011.02", "strength": 0.9 },
      { "competency": "G005.04", "strength": 0.8 },
      { "competency": "G006.01", "strength": 0.9 },
      { "competency": "G009.01", "strength": 0.8 },
      { "competency": "P005.01", "strength": 0.5 },
      { "competency": "P006", "strength": 0.5 },
      { "competency": "P014", "strength": 0.6 },
      { "competency": "F002.01", "strength": 0.9 },
      { "competency": "F002.06", "strength": 0.8 }
    ],
    "scaffold_ladder": [
      "reask with a narrowing question about one part of the image",
      "offer two target words to use",
      "provide the model sentence, learner repeats"
    ] },

  { "id": "EX007", "name": "Personal Questions", "family": "question_answer",
    "stimulus_type": "audio_question", "interaction_mode": "dialogue",
    "cefr_min": "A2", "cefr_max": "C2", "duration_minutes": [3, 5],
    "requires_fluency": [],
    "measures": { "vocabulary": 0.70, "grammar": 0.80, "pronunciation": 0.50, "fluency": 0.85 },
    "elicits": [
      { "competency": "V*", "strength": 0.7, "note": "vocabulary follows the question topic" },
      { "competency": "G001.01", "strength": 0.9 },
      { "competency": "G001.05", "strength": 0.9 },
      { "competency": "G005.01", "strength": 0.9 },
      { "competency": "G005.05", "strength": 0.9 },
      { "competency": "G006.01", "strength": 0.7 },
      { "competency": "G003.01", "strength": 0.7 },
      { "competency": "F003.01", "strength": 0.95 },
      { "competency": "F003.04", "strength": 0.8 },
      { "competency": "F020.05", "strength": 0.6 },
      { "competency": "P006", "strength": 0.5 },
      { "competency": "P014", "strength": 0.6 }
    ],
    "scaffold_ladder": [
      "reask the question more simply",
      "offer a sentence frame to complete",
      "provide the model answer, learner repeats"
    ] },

  { "id": "EX018", "name": "Roleplay", "family": "professional_communication",
    "stimulus_type": "scenario", "interaction_mode": "dialogue",
    "cefr_min": "A2", "cefr_max": "C2", "duration_minutes": [5, 8],
    "requires_fluency": ["F003.01", "F004.01"],
    "measures": { "vocabulary": 0.85, "grammar": 0.75, "pronunciation": 0.55, "fluency": 0.95 },
    "elicits": [
      { "competency": "V*", "strength": 0.9, "note": "vocabulary follows the scenario setting" },
      { "competency": "G001.05", "strength": 0.8 },
      { "competency": "G005.01", "strength": 0.8 },
      { "competency": "G006.01", "strength": 0.8 },
      { "competency": "G015", "strength": 0.7 },
      { "competency": "F003.01", "strength": 0.85 },
      { "competency": "F004.05", "strength": 0.85 },
      { "competency": "F019.01", "strength": 0.9 },
      { "competency": "F019.02", "strength": 0.9 },
      { "competency": "F020.01", "strength": 0.85 },
      { "competency": "P012", "strength": 0.6 },
      { "competency": "P015", "strength": 0.7 }
    ],
    "scaffold_ladder": [
      "the character rephrases and asks again in simpler words",
      "the character offers two possible replies to choose between",
      "provide the model line, learner repeats in character"
    ] }
]
```

Note the deliberate contrast in the `measures` rows. `EX001` observes vocabulary best because the learner must name what they see. `EX018` observes fluency best because the learner must manage a live exchange. `EX007` sits between them. This is what lets the mastery update weight evidence by how well the activity could actually see the skill, and it is why the selector will not try to assess conversation management through a picture.

## A.3 — Still to author

* Metadata for the remaining 83 competencies.  
* Descriptors for the remaining 15 templates, roughly 180 more `elicits` rows.  
* Roles on the remaining 29 domains.  
* `hospitality` Life Path skin, for the Samuel half of the demo.

