import { decode } from "@/lib/geohash"
import { parseTransitRoute } from "./parseRoute"

// accepts `commuteFrom` and `commuteTo` and `routeId` as query params
// splits routeId on "-" to get two geohashes, then decodes them to get longitude and latitude
// Uses the google maps API to get directions from `commuteFrom` to `commuteTo`, and also from the coords of the first geohash to the coords of the second geohash
// Responds with a JSON object containing both sets of directions
// google maps api key is in process.env.GOOGLE_MAPS_API_KEY

const apiKey = process.env.GOOGLE_MAPS_API_KEY
if (!apiKey) {
  throw new Error("Google Maps API key not configured")
}

async function getDirections(
  origin: string | { lat: number; lng: number },
  destination: string | { lat: number; lng: number }
) {
  const formatLocation = (location: string | { lat: number; lng: number }) => {
    if (typeof location === "string") {
      return { address: location }
    } else {
      return {
        location: {
          latLng: { latitude: location.lat, longitude: location.lng },
        },
      }
    }
  }

  const requestBody = {
    origin: formatLocation(origin),
    destination: formatLocation(destination),
    travelMode: "TRANSIT",
    computeAlternativeRoutes: true,
    // transitPreferences: {
    //   routingPreference: "LESS_WALKING",
    //   allowedTravelModes: ["TRAIN"],
    // },
  }

  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey!,
        "X-Goog-FieldMask": "routes.legs.steps.transitDetails",
      },
      body: JSON.stringify(requestBody),
    }
  )

  if (!response.ok) {
    try {
      const data = await response.text()
      console.error(data)
    } catch (error) {
      console.error("Error in getDirections:", error)
    }
    throw new Error(`Directions API error: ${response.status}`)
  }

  const data = await response.json()
  return data
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const commuteFromB = searchParams.get("commuteFrom")
    const commuteToB = searchParams.get("commuteTo")
    const routeId = searchParams.get("routeId")

    if (!commuteFromB || !commuteToB || !routeId) {
      return Response.json(
        { error: "Both commuteFrom and commuteTo parameters are required" },
        { status: 400 }
      )
    }

    const [fromGeohashA, toGeohashA] = routeId.split("-")
    const fromCoordsA = decode(fromGeohashA)
    const toCoordsA = decode(toGeohashA)

    const directionsA = parseTransitRoute(
      await getDirections(
        { lat: fromCoordsA.latitude, lng: fromCoordsA.longitude },
        { lat: toCoordsA.latitude, lng: toCoordsA.longitude }
      )
    )

    const directionsB = parseTransitRoute(
      await getDirections(commuteFromB, commuteToB)
    )
    // console.log(JSON.stringify(directionsA, null))
    // console.log(JSON.stringify(directionsB, null))

    console.log(JSON.stringify(directionsA, null, 2))

    return Response.json({ directionsA, directionsB })
  } catch (error) {
    console.error("Error in encode API:", error)
    return Response.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
}
