import type {
  Cefr,
  Prisma,
  Skill,
  StimulusType,
  InteractionMode,
  TargetRole,
} from "@prisma/client";

/**
 * The A2 curriculum, as data.
 *
 * This is content, not code, and it lives in its own file so that authoring it
 * is a diff a non-engineer can read. Everything the planner and the evaluator
 * do is driven from here — change a success criterion and the next grading uses
 * it, with no deploy of application logic.
 *
 * The ID scheme is one namespace across the whole engine, per section 2 of the
 * session engine doc: `G` grammar, `V` vocabulary, `F` fluency, `S` sentence
 * structure, `EX` exercise template. A sub-competency is the parent's ID plus a
 * two-digit suffix.
 */

export interface CompetencySeed {
  id: string;
  parentId?: string;
  skill: Skill;
  name: string;
  cefrMin: Cefr;
  cefrMax: Cefr;
  observable?: boolean;
  successCriteria: string;
  elicitationCues: string[];
  /** Interference notes keyed by first language. Amharic is the one authored. */
  l1Risk?: Record<string, string>;
  prereqs?: string[];
  errors?: { wrong: string; right: string; tag: string }[];
}

export const COMPETENCIES: CompetencySeed[] = [
  // --- Grammar -------------------------------------------------------------
  {
    id: "G001",
    skill: "GRAMMAR",
    name: "Present simple and present continuous",
    cefrMin: "A1",
    cefrMax: "B1",
    successCriteria:
      "Uses the present simple for habits and facts, and the present continuous for what is happening now, without mixing them.",
    elicitationCues: ["What do you do every day?", "What is happening in this picture?"],
    l1Risk: {
      am: "Amharic marks aspect differently and has no auxiliary 'be', so learners commonly drop 'am/is/are' and say 'I studying'.",
    },
  },
  {
    id: "G001.01",
    parentId: "G001",
    skill: "GRAMMAR",
    name: "Present continuous with the auxiliary 'be'",
    cefrMin: "A1",
    cefrMax: "A2",
    successCriteria: "Includes am/is/are before the -ing form every time.",
    elicitationCues: ["Describe what the people in the picture are doing right now."],
    errors: [
      { wrong: "I studying engineering", right: "I am studying engineering", tag: "missing_be_aux" },
      { wrong: "She work now", right: "She is working now", tag: "missing_be_aux" },
    ],
  },
  {
    id: "G001.02",
    parentId: "G001",
    skill: "GRAMMAR",
    name: "Choosing simple over continuous for habits",
    cefrMin: "A2",
    cefrMax: "B1",
    successCriteria: "Uses the present simple for a routine rather than the continuous.",
    elicitationCues: ["Tell me about your normal week."],
    prereqs: ["G001.01"],
    errors: [
      { wrong: "I am going to class every day", right: "I go to class every day", tag: "continuous_for_habit" },
    ],
  },
  {
    id: "G002",
    skill: "GRAMMAR",
    name: "Past simple",
    cefrMin: "A1",
    cefrMax: "B1",
    successCriteria: "Forms regular and common irregular past tenses correctly.",
    elicitationCues: ["What did you do yesterday?", "Tell me about last weekend."],
    l1Risk: {
      am: "Amharic tense is carried by verb morphology rather than by a separate past form, so learners often leave the verb in its base form.",
    },
    errors: [
      { wrong: "Yesterday I go to the library", right: "Yesterday I went to the library", tag: "bare_verb_for_past" },
      { wrong: "I have went", right: "I went", tag: "past_participle_confusion" },
    ],
  },
  {
    id: "G003",
    skill: "GRAMMAR",
    name: "Articles",
    cefrMin: "A1",
    cefrMax: "B2",
    successCriteria: "Uses a, an and the where English requires them, and omits them where it does not.",
    elicitationCues: ["Describe the room you are in."],
    l1Risk: {
      am: "Amharic has no indefinite article and marks definiteness as a suffix, so both omission and over-use are common.",
    },
    errors: [
      { wrong: "I am student", right: "I am a student", tag: "missing_indefinite_article" },
      { wrong: "I go to the university every day", right: "I go to university every day", tag: "over_used_definite" },
    ],
  },
  {
    id: "G004",
    skill: "GRAMMAR",
    name: "Subject–verb agreement",
    cefrMin: "A1",
    cefrMax: "B1",
    successCriteria: "Matches the verb to the subject, including third-person singular -s.",
    elicitationCues: ["Tell me about your friend and what they do."],
    errors: [
      { wrong: "He study hard", right: "He studies hard", tag: "missing_third_person_s" },
      { wrong: "They is ready", right: "They are ready", tag: "agreement_be" },
    ],
  },
  {
    id: "G005",
    skill: "GRAMMAR",
    name: "Prepositions of time and place",
    cefrMin: "A2",
    cefrMax: "B1",
    successCriteria: "Chooses in, on and at correctly for times and locations.",
    elicitationCues: ["When and where is your next class?"],
    errors: [
      { wrong: "I will meet you in Monday", right: "I will meet you on Monday", tag: "preposition_time" },
      { wrong: "She is in the bus stop", right: "She is at the bus stop", tag: "preposition_place" },
    ],
  },

  // --- Vocabulary ----------------------------------------------------------
  {
    id: "V001",
    skill: "VOCABULARY",
    name: "Everyday and academic range",
    cefrMin: "A1",
    cefrMax: "B1",
    successCriteria: "Chooses words precise enough that the listener does not have to guess.",
    elicitationCues: ["Describe your field of study to someone outside it."],
  },
  {
    id: "V001.01",
    parentId: "V001",
    skill: "VOCABULARY",
    name: "Field-specific nouns",
    cefrMin: "A2",
    cefrMax: "B1",
    successCriteria: "Names the objects and concepts of their own field without falling back on 'thing'.",
    elicitationCues: ["What tools or ideas do you use in your work?"],
    errors: [{ wrong: "the thing for measuring", right: "the multimeter", tag: "vague_noun" }],
  },
  {
    id: "V002",
    skill: "VOCABULARY",
    name: "Descriptive adjectives",
    cefrMin: "A1",
    cefrMax: "A2",
    successCriteria: "Uses more than good, bad and nice when describing something.",
    elicitationCues: ["Describe this picture in as much detail as you can."],
    errors: [{ wrong: "it was very good", right: "it was well organised", tag: "generic_adjective" }],
  },
  {
    id: "V003",
    skill: "VOCABULARY",
    name: "Linking words",
    cefrMin: "A2",
    cefrMax: "B1",
    successCriteria: "Joins ideas with because, so, but and although rather than only 'and'.",
    elicitationCues: ["Explain why you chose your field."],
    errors: [{ wrong: "I was late and the bus was slow", right: "I was late because the bus was slow", tag: "missing_connective" }],
  },

  // --- Fluency -------------------------------------------------------------
  {
    id: "F001",
    skill: "FLUENCY",
    name: "Pace and flow",
    cefrMin: "A1",
    cefrMax: "C1",
    successCriteria: "Speaks at a pace a listener can follow without long unplanned stops.",
    elicitationCues: ["Talk for thirty seconds about your day."],
  },
  {
    id: "F001.05",
    parentId: "F001",
    skill: "FLUENCY",
    name: "Speech rate",
    cefrMin: "A2",
    cefrMax: "B2",
    successCriteria: "Sustains roughly 70 to 130 words per minute over a turn.",
    elicitationCues: ["Keep going for a few more sentences."],
  },
  {
    id: "F001.06",
    parentId: "F001",
    skill: "FLUENCY",
    name: "Pausing",
    cefrMin: "A2",
    cefrMax: "B2",
    successCriteria: "Long pauses take up less than a third of the turn.",
    elicitationCues: ["Try to finish the whole thought before you stop."],
  },
  {
    id: "F003",
    skill: "FLUENCY",
    name: "Answering questions",
    cefrMin: "A1",
    cefrMax: "B1",
    successCriteria: "Begins answering without a long delay and addresses what was asked.",
    elicitationCues: ["Quick question — what did you have for breakfast?"],
  },
  {
    id: "F003.01",
    parentId: "F003",
    skill: "FLUENCY",
    name: "Response latency",
    cefrMin: "A2",
    cefrMax: "B1",
    successCriteria: "Starts speaking within about three seconds of a question ending.",
    elicitationCues: ["Answer as soon as you can — accuracy matters less here."],
  },
  {
    id: "F020",
    skill: "FLUENCY",
    name: "Managing hesitation",
    cefrMin: "A2",
    cefrMax: "B2",
    successCriteria: "Keeps the floor while thinking, without a string of filled pauses.",
    elicitationCues: ["Take a moment, then tell me what you think."],
  },
  {
    id: "F020.05",
    parentId: "F020",
    skill: "FLUENCY",
    name: "Buying thinking time naturally",
    cefrMin: "A2",
    cefrMax: "B1",
    successCriteria:
      "Uses a phrase such as 'let me think' rather than repeated um and uh — fewer than eight filled pauses per hundred words.",
    elicitationCues: ["Here is a harder one. Take your time."],
    errors: [{ wrong: "um um um the the", right: "Let me think about that.", tag: "filled_pauses" }],
  },

  // --- Sentence structure --------------------------------------------------
  {
    id: "S001",
    skill: "SENTENCE_STRUCTURE",
    name: "Complete sentences",
    cefrMin: "A1",
    cefrMax: "B1",
    successCriteria: "Every utterance has a subject and a finite verb.",
    elicitationCues: ["Answer in a full sentence."],
    l1Risk: {
      am: "Amharic drops the subject pronoun freely because the verb carries the person, so English sentences arrive without one.",
    },
    errors: [
      { wrong: "Is very difficult", right: "It is very difficult", tag: "missing_subject" },
      { wrong: "Because I was tired", right: "I stayed home because I was tired", tag: "fragment" },
    ],
  },
  {
    id: "S002",
    skill: "SENTENCE_STRUCTURE",
    name: "Sentence boundaries",
    cefrMin: "A2",
    cefrMax: "B2",
    successCriteria: "Ends one idea before starting the next, rather than chaining with 'and'.",
    elicitationCues: ["Tell me the whole story, from the beginning."],
  },
  {
    id: "S002.01",
    parentId: "S002",
    skill: "SENTENCE_STRUCTURE",
    name: "Sentence length",
    cefrMin: "A2",
    cefrMax: "B1",
    successCriteria: "Averages roughly six to fourteen words per sentence — neither fragments nor run-ons.",
    elicitationCues: ["Try to say that as two separate sentences."],
    errors: [
      {
        wrong: "I woke up and I went to class and the teacher was late and then we started and it was hard",
        right: "I woke up and went to class. The teacher was late, so we started late. It was hard.",
        tag: "run_on",
      },
    ],
  },
  {
    id: "S003",
    skill: "SENTENCE_STRUCTURE",
    name: "Word order",
    cefrMin: "A1",
    cefrMax: "B1",
    successCriteria: "Uses subject–verb–object order, including in questions.",
    elicitationCues: ["Ask me a question about my work."],
    l1Risk: {
      am: "Amharic is subject–object–verb, so the verb tends to arrive at the end of an English sentence.",
    },
    errors: [
      { wrong: "I to the market went", right: "I went to the market", tag: "verb_final" },
      { wrong: "You are from where?", right: "Where are you from?", tag: "question_order" },
    ],
  },
];

// --- templates -------------------------------------------------------------

export interface TemplateSeed {
  id: string;
  family: string;
  stimulusType: StimulusType;
  interactionMode: InteractionMode;
  cefrMin: Cefr;
  cefrMax: Cefr;
  durationMinSec: number;
  durationMaxSec: number;
  scaffoldLadder: string[];
  /** How well this template measures each skill, 0..1. */
  measures: Partial<Record<Skill, number>>;
  /** Which competencies it reliably produces, and how reliably. */
  elicits: Record<string, number>;
}

export const TEMPLATES: TemplateSeed[] = [
  {
    id: "EX001",
    family: "PICTURE_DESCRIPTION",
    stimulusType: "IMAGE",
    interactionMode: "MONOLOGUE",
    cefrMin: "A1",
    cefrMax: "B1",
    durationMinSec: 60,
    durationMaxSec: 180,
    scaffoldLadder: [
      "What can you see?",
      "Try starting with 'In this picture, there is…'",
      "Describe one person and what they are doing right now.",
    ],
    // A picture description is excellent evidence about vocabulary and the
    // present continuous, and only fair evidence about fluency — the learner
    // can pause as long as they like without it being a fluency problem.
    measures: { VOCABULARY: 0.9, GRAMMAR: 0.8, SENTENCE_STRUCTURE: 0.7, FLUENCY: 0.5 },
    elicits: {
      "G001.01": 1,
      G003: 0.8,
      V002: 1,
      "V001.01": 0.6,
      S001: 0.9,
      "F001.05": 0.5,
      "F001.06": 0.5,
      "S002.01": 0.8,
    },
  },
  {
    id: "EX007",
    family: "OPINION_PROMPT",
    stimulusType: "TOPIC",
    interactionMode: "DIALOGUE",
    cefrMin: "A2",
    cefrMax: "C1",
    durationMinSec: 90,
    durationMaxSec: 240,
    scaffoldLadder: [
      "What do you think?",
      "Try 'I think… because…'",
      "Give me one reason, then one example.",
    ],
    measures: { GRAMMAR: 0.8, VOCABULARY: 0.8, FLUENCY: 0.9, SENTENCE_STRUCTURE: 0.9 },
    elicits: {
      V003: 1,
      G002: 0.6,
      G004: 0.7,
      S002: 1,
      "S002.01": 1,
      "F020.05": 0.9,
      "F001.05": 0.9,
      "F001.06": 0.9,
      "F003.01": 0.7,
    },
  },
  {
    id: "EX008",
    family: "ROLE_PLAY",
    stimulusType: "SCENARIO",
    interactionMode: "DIALOGUE",
    cefrMin: "A2",
    cefrMax: "C1",
    durationMinSec: 120,
    durationMaxSec: 300,
    scaffoldLadder: [
      "What would you say?",
      "Start by greeting them.",
      "Try: 'Excuse me, could you tell me…'",
    ],
    measures: { FLUENCY: 1, GRAMMAR: 0.7, VOCABULARY: 0.8, SENTENCE_STRUCTURE: 0.7 },
    elicits: {
      "F003.01": 1,
      "F020.05": 0.9,
      S003: 0.9,
      G005: 0.8,
      "V001.01": 0.8,
      "F001.05": 0.8,
      "F001.06": 0.8,
      "S002.01": 0.6,
    },
  },
  {
    id: "EX009",
    family: "PERSONAL_NARRATIVE",
    stimulusType: "TOPIC",
    interactionMode: "MONOLOGUE",
    cefrMin: "A2",
    cefrMax: "B2",
    durationMinSec: 90,
    durationMaxSec: 240,
    scaffoldLadder: [
      "Tell me what happened.",
      "Start with when it was.",
      "What happened first? And then?",
    ],
    measures: { GRAMMAR: 0.9, SENTENCE_STRUCTURE: 0.9, FLUENCY: 0.8, VOCABULARY: 0.6 },
    elicits: {
      G002: 1,
      "G001.02": 0.8,
      V003: 0.8,
      S002: 1,
      "S002.01": 1,
      S001: 0.8,
      "F001.05": 0.8,
      "F001.06": 0.8,
    },
  },
  {
    id: "EX018",
    family: "SENTENCE_REBUILD",
    stimulusType: "TEXT",
    interactionMode: "REPETITION",
    cefrMin: "A1",
    cefrMax: "B1",
    durationMinSec: 30,
    durationMaxSec: 90,
    scaffoldLadder: ["Say it correctly.", "Listen again and repeat.", "Here is the answer — say it after me."],
    // Narrow and reliable: it targets one form and measures nothing else well.
    measures: { GRAMMAR: 1, SENTENCE_STRUCTURE: 0.8, VOCABULARY: 0.3, FLUENCY: 0.2 },
    elicits: { "G001.01": 1, G004: 1, G003: 0.9, S003: 1, S001: 0.9 },
  },
];

// --- domains and life paths ------------------------------------------------

export interface DomainSeed {
  id: string;
  cefr: Cefr;
  name: string;
  description: string;
  objectives: string[];
  contexts: string[];
  requires: { competencyId: string; role: TargetRole; weight: number }[];
}

export const DOMAINS: DomainSeed[] = [
  {
    id: "A2-D01",
    cefr: "A2",
    name: "Talking about yourself and your work",
    description:
      "Introducing yourself, describing what you study or do, and explaining a routine — the ground every other A2 domain is built on.",
    objectives: [
      "Introduce yourself and your field in complete sentences",
      "Describe a habit and something happening now, without mixing the two",
      "Tell a short story about something that already happened",
    ],
    contexts: ["classroom", "workplace", "meeting someone new"],
    requires: [
      { competencyId: "G001.01", role: "CORE", weight: 1.5 },
      { competencyId: "G001.02", role: "CORE", weight: 1.2 },
      { competencyId: "G002", role: "CORE", weight: 1.4 },
      { competencyId: "G003", role: "SUPPORTING", weight: 1 },
      { competencyId: "G004", role: "CORE", weight: 1.3 },
      { competencyId: "G005", role: "SUPPORTING", weight: 0.8 },
      { competencyId: "V001.01", role: "CORE", weight: 1.3 },
      { competencyId: "V002", role: "SUPPORTING", weight: 1 },
      { competencyId: "V003", role: "CORE", weight: 1.2 },
      { competencyId: "F001.05", role: "SUPPORTING", weight: 1 },
      { competencyId: "F001.06", role: "SUPPORTING", weight: 1 },
      { competencyId: "F003.01", role: "SUPPORTING", weight: 0.9 },
      { competencyId: "F020.05", role: "CORE", weight: 1.1 },
      { competencyId: "S001", role: "CORE", weight: 1.4 },
      { competencyId: "S002.01", role: "CORE", weight: 1.3 },
      { competencyId: "S003", role: "CORE", weight: 1.2 },
    ],
  },
];

export interface LifePathSeed {
  id: string;
  name: string;
  theme: string;
  isLive: boolean;
  domains: { domainId: string; priority: number }[];
}

export const LIFE_PATHS: LifePathSeed[] = [
  {
    id: "university_success",
    name: "University success",
    theme: "university_success",
    isLive: true,
    domains: [{ domainId: "A2-D01", priority: 1 }],
  },
  {
    id: "hospitality",
    name: "Hospitality and tourism",
    theme: "hospitality",
    isLive: true,
    domains: [{ domainId: "A2-D01", priority: 1 }],
  },
  {
    // Authored content does not exist yet, so it must not be selectable. The
    // `isLive` flag is what the profile endpoint checks.
    id: "job_interview",
    name: "Job interviews",
    theme: "job_interview",
    isLive: false,
    domains: [],
  },
];

// --- stimulus pool ---------------------------------------------------------

export interface StimulusSeed {
  templateId: string;
  targetSetKey: string;
  theme: string;
  stimulusType: StimulusType;
  /**
   * The shape the renderer reads, which differs per stimulus type and so is
   * a JSON column rather than a table.
   *
   * Prisma's own input type rather than `Record<string, unknown>`: the column
   * cannot hold a `Date`, a function or an `undefined`, and typing it loosely
   * moves that from a compile error to a runtime one.
   */
  spec: Prisma.InputJsonObject;
}

/**
 * Enough pre-generated material for a demo to run without an image model.
 *
 * `theme: "generic"` entries are the second rung of the fallback in
 * `findStimulus`: when nothing matches the learner's Life Path, they still get
 * the right competencies in a less tailored setting rather than a spinner.
 */
export const STIMULI: StimulusSeed[] = [
  {
    templateId: "EX007",
    targetSetKey: "generic",
    theme: "university_success",
    stimulusType: "TOPIC",
    spec: {
      kind: "topic",
      topic: "Your course",
      prompt:
        "Tell me about what you are studying. What is it, and why did you choose it?",
    },
  },
  {
    templateId: "EX009",
    targetSetKey: "generic",
    theme: "university_success",
    stimulusType: "TOPIC",
    spec: {
      kind: "topic",
      topic: "A difficult day",
      prompt:
        "Tell me about a day at university that did not go to plan. What happened?",
    },
  },
  {
    templateId: "EX008",
    targetSetKey: "generic",
    theme: "university_success",
    stimulusType: "SCENARIO",
    spec: {
      kind: "scenario",
      setting: "After a lecture",
      role: "You did not understand part of the lecture and want to ask the lecturer.",
      prompt:
        "You are talking to your lecturer after class. Ask them to explain the part you missed.",
    },
  },
  {
    templateId: "EX007",
    targetSetKey: "generic",
    theme: "hospitality",
    stimulusType: "TOPIC",
    spec: {
      kind: "topic",
      topic: "Looking after guests",
      prompt: "What makes a guest feel welcome? Tell me what you would do.",
    },
  },
  {
    templateId: "EX008",
    targetSetKey: "generic",
    theme: "hospitality",
    stimulusType: "SCENARIO",
    spec: {
      kind: "scenario",
      setting: "Hotel front desk",
      role: "A guest arrives and their room is not ready.",
      prompt:
        "A guest has arrived early and their room is not ready. Speak to them.",
    },
  },
  {
    templateId: "EX007",
    targetSetKey: "generic",
    theme: "generic",
    stimulusType: "TOPIC",
    spec: {
      kind: "topic",
      topic: "Your week",
      prompt: "Tell me about your week. What did you do, and what is coming up?",
    },
  },
  {
    templateId: "EX009",
    targetSetKey: "generic",
    theme: "generic",
    stimulusType: "TOPIC",
    spec: {
      kind: "topic",
      topic: "Something you remember",
      prompt: "Tell me about something that happened to you recently.",
    },
  },
  {
    templateId: "EX001",
    targetSetKey: "generic",
    theme: "generic",
    stimulusType: "IMAGE",
    spec: {
      kind: "image",
      // No asset yet. The client renders the description as text, which is the
      // third rung of the fallback and still a usable exercise.
      alt: "A busy market street with people buying and selling",
      prompt: "Describe what you can see. What are the people doing right now?",
    },
  },
  {
    templateId: "EX018",
    targetSetKey: "generic",
    theme: "generic",
    stimulusType: "TEXT",
    spec: {
      kind: "statement",
      text: "I studying engineering at the university.",
      prompt: "This sentence has two mistakes. Say it correctly.",
    },
  },
];
