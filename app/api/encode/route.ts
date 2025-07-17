import { encode } from "@/lib/geohash"

// accepts `commuteFrom` and `commuteTo` as query params - these are both place names or addresses
// uses the Google Maps API to get the latitude and longitude of the two places
// responds with a JSON object containing the 6 digit geohash of the two places
// google maps api key is in process.env.GOOGLE_MAPS_API_KEY

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const commuteFrom = searchParams.get("commuteFrom")
    const commuteTo = searchParams.get("commuteTo")

    if (!commuteFrom || !commuteTo) {
      return Response.json(
        { error: "Both commuteFrom and commuteTo parameters are required" },
        { status: 400 }
      )
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return Response.json(
        { error: "Google Maps API key not configured" },
        { status: 500 }
      )
    }

    const geocodeLocation = async (address: string) => {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          address
        )}&key=${apiKey}`
      )

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`)
      }

      const data = await response.json()

      if (data.status !== "OK" || !data.results || data.results.length === 0) {
        throw new Error(`Could not geocode address: ${address}`)
      }

      const location = data.results[0].geometry.location
      return { lat: location.lat, lng: location.lng }
    }

    const [fromLocation, toLocation] = await Promise.all([
      geocodeLocation(commuteFrom),
      geocodeLocation(commuteTo),
    ])

    const fromGeohash = encode(fromLocation.lat, fromLocation.lng, 6)
    const toGeohash = encode(toLocation.lat, toLocation.lng, 6)

    return Response.json({
      commuteFrom: {
        address: commuteFrom,
        geohash: fromGeohash,
        coordinates: fromLocation,
      },
      commuteTo: {
        address: commuteTo,
        geohash: toGeohash,
        coordinates: toLocation,
      },
    })
  } catch (error) {
    console.error("Error in encode API:", error)
    return Response.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
}
