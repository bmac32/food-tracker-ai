/**
 * Under-fueling guidance library (backlog #10).
 *
 * The dietitian's honest take on chronic under-eating, as citable facts.
 * The coach's model may ONLY use these facts — rewritten in its own warm
 * words — and must never invent mechanisms, numbers, or claims.
 *
 * Deliberately honest where pop nutrition isn't: metabolic adaptation
 * ("starvation mode") is real but small and transient, so the library
 * leads with what's actually well-evidenced — lean-mass loss, hormonal
 * disruption (RED-S), and the restrict→rebound cycle.
 *
 * This doubles as the practitioner content pipeline (backlog #7):
 * dietitians will eventually attach their own cards here.
 */
export type UnderfuelFact = {
  id: string
  fact: string
  source: string
}

export const UNDERFUEL_FACTS: UnderfuelFact[] = [
  {
    id: "F1",
    fact:
      "When you eat well under what your body needs for days on end, a meaningful share of the weight you lose is muscle, not fat. " +
      "Muscle is what keeps you strong, steady, and moving well — and it's the biggest driver of the energy your body uses each day.",
    source: "body-composition research",
  },
  {
    id: "F2",
    fact:
      "Sports-medicine researchers call a lasting gap between fuel in and fuel needed 'low energy availability'. " +
      "When it persists, it can disrupt hormones, bone strength, immunity, and mood — in anyone, not just athletes.",
    source: "IOC RED-S consensus, Br J Sports Med",
  },
  {
    id: "F3",
    fact:
      "Eating too little for days reliably ramps up preoccupation with food and rebound eating afterward. " +
      "It's the restriction cycle doing that, not a lack of willpower.",
    source: "eating-behavior research",
  },
  {
    id: "F4",
    fact:
      "The 'slowed metabolism' effect of eating less is real but small — roughly 50–100 calories a day — " +
      "and it fades once eating steadies. It's not the main reason chronic under-eating backfires.",
    source: "systematic review, Br J Nutr",
  },
]

export function getUnderfuelFact(id: string): UnderfuelFact | undefined {
  return UNDERFUEL_FACTS.find((f) => f.id === id)
}

/** Rendered verbatim into the coach prompt — the model's entire fact universe. */
export function underfuelLibraryText(): string {
  return UNDERFUEL_FACTS.map((f) => `${f.id}: ${f.fact} (source: ${f.source})`).join("\n")
}
