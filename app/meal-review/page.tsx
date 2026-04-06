import MealReviewCard from "../../components/MealReviewCard"

export default function Page() {
  const meal = {
    image_url: "/file.svg",
    title: "Chicken rice bowl",
    ingredients: [
      { name: "chicken" },
      { name: "rice" },
      { name: "avocado" },
    ],
    calories: 500,
    protein: 35,
    carbs: 45,
    fat: 20,
  }

  return (
  <MealReviewCard
    imageUrl={meal.image_url}
    analysis={{
      meal_name: meal.title,
      foods: meal.ingredients.map(i => i.name),
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
    }}
    note=""
    setNote={() => {}}
    onSave={() => {}}
    analyzing={false}
    isSaving={false}
    saveSuccess={false}
    onCancel={() => {}}
  />
)
}