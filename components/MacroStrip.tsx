export default function MacroStrip({ meal }) {
  return (
    <div className="flex justify-between mt-4 text-center">
      <Macro label="Calories" value={meal.calories} />
      <Macro label="Protein" value={meal.protein} />
      <Macro label="Carbs" value={meal.carbs} />
      <Macro label="Fat" value={meal.fat} />
    </div>
  )
}

function Macro({ label, value }) {
  return (
    <div>
      <div className="text-lg font-semibold">{value || "-"}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}