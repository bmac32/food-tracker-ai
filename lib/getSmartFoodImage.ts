export async function getSmartFoodImage(mealName: string, foods?: string[]) {
  try {
    const accessKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY

    if (!accessKey) {
      console.error("Missing Unsplash key")
      return fallbackImage()
    }

    const queryParts = foods?.length
      ? foods.slice(0, 3)
      : mealName.split(" ").slice(0, 3)

    const query = queryParts.join(" ")

    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        query + " food"
      )}&per_page=10&orientation=squarish`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
        },
      }
    )

    const data = await res.json()

    if (!data.results || data.results.length === 0) {
      return fallbackImage()
    }

    const random =
      data.results[Math.floor(Math.random() * data.results.length)]

    return random.urls.regular
  } catch (err) {
    console.error("Unsplash failed", err)
    return fallbackImage()
  }
}

function fallbackImage() {
  return "https://images.unsplash.com/photo-1498837167922-ddd27525d352"
}