const apiKey = process.env.GOOGLE_MAPS_API_KEY
if (!apiKey) {
  throw new Error("GOOGLE_MAPS_API_KEY is not set")
}

export interface Coordinates {
  lat: number
  lng: number
}

export async function geocodeLocation(address: string): Promise<Coordinates> {
  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey!,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location"
      },
      body: JSON.stringify({
        textQuery: address
      })
    }
  )

  if (!response.ok) {
    try {
      const data = await response.text()
      console.error(data)
    } catch (error) {
      console.error("Error in places API:", error)
    }
    throw new Error(`Places API error: ${response.status}`)
  }

  const data = await response.json()

  if (!data.places || data.places.length === 0) {
    throw new Error(`Could not find location: ${address}`)
  }

  console.log(JSON.stringify(data, null, 2))

  const location = data.places[0].location
  return { lat: location.latitude, lng: location.longitude }
}