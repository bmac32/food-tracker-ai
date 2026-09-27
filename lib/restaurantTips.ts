/**
 * Restaurant / eating-out guidance library (backlog #7).
 *
 * One practical, non-shaming tip surfaced in the coach when the just-logged
 * day looks like eating out — never preachy, never wordy. Claims are kept
 * modest and hedged; nutrient comparisons are USDA-grounded.
 *
 * Same pattern as lib/underfuelGuidance.ts: curated facts, model never
 * freestyles. Practitioners will eventually attach their own content
 * links here (backlog #7 distribution hook).
 */
export type RestaurantTip = {
  /** keywords matched (case-insensitive) against today's meal names */
  match: string[]
  tip: string
  source: string
}

export const RESTAURANT_TIPS: RestaurantTip[] = [
  {
    match: ["sushi", "poke"],
    tip: "Sushi rice is seasoned with sugar and rice vinegar — a few grams of sugar per roll you won't taste.",
    source: "USDA FoodData Central",
  },
  {
    match: ["salad"],
    tip: "In restaurant salads the dressing and toppings often outweigh the greens on calories — on the side keeps the numbers honest.",
    source: "USDA FoodData Central",
  },
  {
    match: ["pizza", "burger", "fries", "fried", "nugget", "wings"],
    tip: "Restaurant fryers and grills run heavy on oil — the same food cooked at home usually lands lighter.",
    source: "USDA FoodData Central",
  },
  {
    match: [
      "pasta",
      "alfredo",
      "pad thai",
      "ramen",
      "curry",
      "taco",
      "burrito",
      "quesadilla",
      "teriyaki",
      "orange chicken",
      "lo mein",
      "pho",
    ],
    tip: "Restaurant sauces and glazes pour heavier on sugar and oil than home cooking — worth a spoonful less when you're estimating.",
    source: "USDA FoodData Central",
  },
]

/** First tip whose keywords appear in any of today's meal names. */
export function findRestaurantTip(mealNames: string[]): RestaurantTip | null {
  const text = mealNames.join(" ").toLowerCase()
  if (!text.trim()) return null
  for (const t of RESTAURANT_TIPS) {
    if (t.match.some((k) => text.includes(k))) return t
  }
  return null
}
