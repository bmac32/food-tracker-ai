"use client"

import { useState } from "react"

type Ingredient = {
    name: string
}

export default function IngredientChips({
  ingredients = [],
  onChange,
}: {
  ingredients: Ingredient[]
  onChange: (items: Ingredient[]) => void
}) {
  const [items, setItems] = useState<Ingredient[]>(ingredients)

  function removeItem(index: number) {
    const updated = items.filter((_, i) => i !== index)
    setItems(updated)
    onChange(updated)
  }

  function addItem(label: string) {
    if (!label) return
    const updated = [...items, { name: label }]
    setItems(updated)
    onChange(updated)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center bg-gray-100 px-3 py-1 rounded-full text-sm"
          >
            {item.name}
            <button
              onClick={() => removeItem(i)}
              className="ml-2 text-gray-400"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <input
        placeholder="+ add ingredient"
        className="mt-2 text-sm outline-none"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const value = (e.target as HTMLInputElement).value
            addItem(value)
            ;(e.target as HTMLInputElement).value = ""
          }
        }}
      />
    </div>
  )
}