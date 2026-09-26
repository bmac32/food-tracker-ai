/**
 * Photo learning — the feedback loop that makes dish photos better over
 * time. Every time she picks a photo (or thumbs-downs one), we record
 * which dish it was for. Next time a similar dish is logged, her past
 * picks win over any search.
 */

/** Normalized dish key: "breakfast burrito" == "Breakfast Burrito!" */
export function dishKey(mealName?: string, foods?: string[]): string {
  const parts = [
    mealName || "",
    ...(Array.isArray(foods) ? foods : []).map((f) =>
      typeof f === "string" ? f : (f as any)?.item || ""
    ),
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
  return [...new Set(parts)].sort().join(" ")
}

const STOPWORDS = new Set([
  "with",
  "and",
  "the",
  "a",
  "an",
  "of",
  "on",
  "plated",
  "served",
  "fresh",
  "sliced",
  "slices",
  "bowl",
  "plate",
])

/** Significant words for fuzzy dish matching ("apple peanut butter"). */
export function significantWords(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
}
