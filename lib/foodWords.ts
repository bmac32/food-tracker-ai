/**
 * Shared food-name word helpers.
 *
 * Used by the correction matcher (foodTruth.ts) and the USDA relevance
 * check (usda.ts). Kept in its own module because foodTruth imports usda —
 * putting these here avoids a circular import.
 *
 * Matching helpers only: storage keys still come from normalizeFoodKey,
 * whose output is never altered here.
 */

/** Canonical key for a food name: "  Dill  Pickles " -> "dill pickles". */
export function normalizeFoodKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ")
}

// Words that carry no food meaning — dropped before matching.
const STOPWORDS = new Set([
  "with",
  "and",
  "or",
  "of",
  "a",
  "an",
  "the",
  "in",
  "on",
  "to",
  "for",
])

/** Tiny stemmer so "blueberries" matches "blueberry" (applied to both sides). */
export function stemWord(w: string): string {
  let s = w.toLowerCase()
  if (s.length > 3) {
    if (s.endsWith("ies")) s = s.slice(0, -3) + "y"
    else if (/(oes|ses|xes|zes|ches|shes)$/.test(s)) s = s.slice(0, -2)
    else if (s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1)
  }
  return s
}

/**
 * Stemmed content words for matching: "Cappuccino with Oat Milk" ->
 * ["cappuccino", "oat", "milk"]; "Cheese, cheddar" -> ["cheese", "cheddar"].
 * Punctuation is stripped for matching only — storage keys are unaffected.
 */
export function contentWords(name: string): string[] {
  return normalizeFoodKey(name)
    .replace(/[^a-z0-9\s]/g, "")
    .split(" ")
    .map(stemWord)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
}

/** True when every word of `phrase` appears contiguously inside `words`. */
export function containsPhrase(words: string[], phrase: string[]): boolean {
  if (phrase.length === 0 || phrase.length > words.length) return false
  for (let i = 0; i <= words.length - phrase.length; i++) {
    let ok = true
    for (let j = 0; j < phrase.length; j++) {
      if (words[i + j] !== phrase[j]) {
        ok = false
        break
      }
    }
    if (ok) return true
  }
  return false
}

/**
 * Jaccard similarity of two word lists (0..1): 1 when they agree,
 * lower as they diverge. "ice" vs ["ice","cream","vanilla"] scores 0.33.
 */
export function wordSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  let inter = 0
  for (const w of new Set(a)) if (setB.has(w)) inter++
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : inter / union
}
