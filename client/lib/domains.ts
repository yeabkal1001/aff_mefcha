/**
 * The curriculum domains, as much of them as the browser needs.
 *
 * A projection of `docs/curriculum/domains.md`: the id, what the domain is
 * for, and its objectives — enough to tell a learner what a stretch of the
 * curriculum will teach them. The competency requirements that actually drive
 * scheduling stay on the server, because nothing on screen is decided by them.
 *
 * `domainPriority` per Life Path mirrors the overlay in `session-engine.md`
 * §7. A domain absent from a path's map is not excluded — it is simply reached
 * later, since `highestPriorityIncompleteDomain` falls back to curriculum
 * order once the prioritised ones are complete.
 */

import type { LifePathId } from "./onboarding";
import type { Cefr } from "./templates";

export interface Domain {
  id: string;
  cefr: Cefr;
  name: string;
  /** One sentence, from the curriculum's own description. */
  description: string;
  /** What the learner will be able to do. Verbatim from the curriculum. */
  objectives: string[];
  /** Rooms the domain is practised in, before the Life Path renames them. */
  contexts: string[];
  /** Rough number of practice days at the default budget. */
  estimatedDays: number;
}

export const domains: Domain[] = [
  {
    id: "A2-D01",
    cefr: "A2",
    name: "Personal Life",
    description:
      "Communicate about oneself and familiar people in everyday situations.",
    objectives: [
      "Introduce yourself confidently",
      "Describe family and friends",
      "Talk about daily routines",
      "Express basic likes and dislikes",
      "Describe personal experiences",
    ],
    contexts: [
      "Introducing yourself",
      "Meeting someone new",
      "Talking about hobbies",
      "Daily routine",
      "Weekend activities",
    ],
    estimatedDays: 7,
  },
  {
    id: "A2-D02",
    cefr: "A2",
    name: "Home & Community",
    description:
      "Communicate about familiar places and navigate common local situations.",
    objectives: [
      "Describe your home",
      "Describe your neighbourhood",
      "Ask for and give directions",
      "Describe locations",
    ],
    contexts: ["At home", "Visiting a friend", "Walking in town", "Asking for directions"],
    estimatedDays: 5,
  },
  {
    id: "A2-D03",
    cefr: "A2",
    name: "Everyday Transactions",
    description: "Handle routine service interactions confidently.",
    objectives: [
      "Buy products",
      "Order food",
      "Make simple requests",
      "Understand prices",
      "Solve basic service issues",
    ],
    contexts: ["Supermarket", "Restaurant", "Coffee shop", "Pharmacy", "Ticket office"],
    estimatedDays: 5,
  },
  {
    id: "A2-D04",
    cefr: "A2",
    name: "Health & Well-being",
    description: "Communicate simple health concerns and healthy habits.",
    objectives: ["Describe symptoms", "Ask for help", "Discuss healthy routines"],
    contexts: ["Clinic", "Pharmacy", "Exercise", "Visiting a doctor"],
    estimatedDays: 4,
  },
  {
    id: "A2-D05",
    cefr: "A2",
    name: "Travel",
    description: "Handle common travel situations.",
    objectives: [
      "Ask for travel information",
      "Describe destinations",
      "Handle simple travel problems",
    ],
    contexts: ["Airport", "Bus station", "Taxi", "Hotel", "Tourist attraction"],
    estimatedDays: 5,
  },
  {
    id: "A2-D06",
    cefr: "A2",
    name: "Social Interaction",
    description: "Participate naturally in short everyday conversations.",
    objectives: [
      "Start conversations",
      "Continue conversations",
      "Express preferences",
      "Respond politely",
    ],
    contexts: ["Small talk", "Meeting friends", "Invitations", "Phone conversation"],
    estimatedDays: 6,
  },
];

export function domainsAtLevel(cefr: Cefr): Domain[] {
  return domains.filter((d) => d.cefr === cefr);
}

export function domainById(id: string): Domain | undefined {
  return domains.find((d) => d.id === id);
}

/**
 * Life Path overlays, mirroring `domain_priority` in the engine.
 *
 * A path reorders the curriculum; it never replaces it. Hana reaches
 * `A2-D03 Everyday Transactions` too — after the two domains her degree needs
 * first, and set in a campus cafeteria rather than a generic shop.
 */
export const domainPriority: Partial<Record<LifePathId, Record<string, number>>> = {
  general_english: {
    "A2-D01": 1.0,
    "A2-D06": 0.85,
    "A2-D03": 0.8,
    "A2-D02": 0.6,
    "A2-D05": 0.5,
    "A2-D04": 0.4,
  },
  university_success: {
    "A2-D01": 1.0,
    "A2-D06": 0.9,
    "A2-D02": 0.4,
    "A2-D03": 0.35,
    "A2-D05": 0.3,
    "A2-D04": 0.2,
  },
  hospitality: {
    "A2-D03": 1.0,
    "A2-D06": 0.9,
    "A2-D05": 0.8,
    "A2-D01": 0.6,
    "A2-D02": 0.4,
    "A2-D04": 0.3,
  },
};

/**
 * Domain order for a path, highest priority first.
 *
 * Ties and unlisted domains fall back to curriculum order, which is what makes
 * the sequence deterministic — two learners on the same path see the same
 * order, and the outline is reproducible rather than sampled.
 */
export function orderedDomains(lifePathId: LifePathId, cefr: Cefr): Domain[] {
  const priority = domainPriority[lifePathId] ?? domainPriority.general_english ?? {};
  const available = domainsAtLevel(cefr);

  return [...available].sort((a, b) => {
    const delta = (priority[b.id] ?? 0) - (priority[a.id] ?? 0);
    return delta !== 0 ? delta : a.id.localeCompare(b.id);
  });
}
