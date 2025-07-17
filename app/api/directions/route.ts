import { decode } from "@/lib/geohash"
import { getDirections, geocodeLocation } from "@/lib/places"
import { parseTransitRoute } from "./parseRoute"

// accepts `commuteFrom` and `commuteTo` and `routeId` as query params
// splits routeId on "-" to get two geohashes, then decodes them to get longitude and latitude
// Uses the google maps API to get directions from `commuteFrom` to `commuteTo`, and also from the coords of the first geohash to the coords of the second geohash
// Responds with a JSON object containing both sets of directions
// google maps api key is in process.env.GOOGLE_MAPS_API_KEY


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

    const [fromLocationB, toLocationB] = await Promise.all([
      geocodeLocation(commuteFromB),
      geocodeLocation(commuteToB),
    ])

    const directionsB = parseTransitRoute(
      await getDirections(fromLocationB, toLocationB)
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
