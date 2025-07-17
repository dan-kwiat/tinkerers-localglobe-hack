interface TransitStop {
  name: string
  location: {
    latitude: number
    longitude: number
  }
}

interface TransitLine {
  name: string
  nameShort: string
  color: string
  vehicleType: string
}

interface TransitStep {
  name: string
  stationTypes: string[]
  lines: string[]
  departureTime?: string
  arrivalTime?: string
  location: {
    latitude: number
    longitude: number
  }
}

export function parseTransitRoute(jsonData: any): TransitStep[] {
  const steps: TransitStep[] = []

  // Get the first route only
  const firstRoute = jsonData.routes[0]
  if (!firstRoute || !firstRoute.legs) {
    return steps
  }

  // Process each leg of the first route
  for (const leg of firstRoute.legs) {
    if (!leg.steps) continue

    // Filter out empty steps and process each step
    const nonEmptySteps = leg.steps.filter(
      (step: any) => step && Object.keys(step).length > 0
    )

    for (const step of nonEmptySteps) {
      if (step.transitDetails) {
        const { transitDetails } = step
        const { stopDetails, transitLine } = transitDetails

        // Process departure stop
        if (stopDetails.departureStop) {
          const departureStop = stopDetails.departureStop
          const departureStep: TransitStep = {
            name: departureStop.name,
            stationTypes: determineStationTypes(
              departureStop.name,
              transitLine
            ),
            lines: extractLines(transitLine),
            departureTime: stopDetails.departureTime,
            location: {
              latitude: departureStop.location.latLng.latitude,
              longitude: departureStop.location.latLng.longitude,
            },
          }

          // Check if this stop is already in our steps (avoid duplicates)
          if (!steps.some((s) => s.name === departureStep.name)) {
            steps.push(departureStep)
          }
        }

        // Process arrival stop
        if (stopDetails.arrivalStop) {
          const arrivalStop = stopDetails.arrivalStop
          const arrivalStep: TransitStep = {
            name: arrivalStop.name,
            stationTypes: determineStationTypes(arrivalStop.name, transitLine),
            lines: extractLines(transitLine),
            arrivalTime: stopDetails.arrivalTime,
            location: {
              latitude: arrivalStop.location.latLng.latitude,
              longitude: arrivalStop.location.latLng.longitude,
            },
          }

          // Check if this stop is already in our steps (avoid duplicates)
          if (!steps.some((s) => s.name === arrivalStep.name)) {
            steps.push(arrivalStep)
          }
        }
      }
    }
  }

  return steps
}

function determineStationTypes(
  stationName: string,
  transitLine?: any
): string[] {
  const types: string[] = []

  // Check if it's a tube/underground station
  if (
    stationName.includes("Station") ||
    stationName.includes("Underground") ||
    stationName.includes("St. Pancras") ||
    stationName.includes("King's Cross") ||
    stationName.includes("Highbury & Islington")
  ) {
    // Check if it's specifically a major interchange
    if (
      stationName.includes("King's Cross") ||
      stationName.includes("St. Pancras") ||
      stationName.includes("Highbury & Islington")
    ) {
      types.push("Tube Station")
      types.push("Major Interchange")
    } else {
      types.push("Tube Station")
    }
  }

  // Check if it's a bus stop
  if (
    stationName.includes("Stop") ||
    stationName.includes("(Stop") ||
    (!stationName.includes("Station") && transitLine?.vehicle?.type === "BUS")
  ) {
    types.push("Bus Stop")
  }

  // If no specific type found, try to infer from transit line
  if (types.length === 0 && transitLine) {
    if (transitLine.vehicle?.type === "BUS") {
      types.push("Bus Stop")
    } else if (transitLine.vehicle?.type === "SUBWAY") {
      types.push("Tube Station")
    }
  }

  // Default fallback
  if (types.length === 0) {
    types.push("Unknown")
  }

  return types
}

function extractLines(transitLine: any): string[] {
  const lines: string[] = []

  if (transitLine) {
    // Add the main line name
    if (transitLine.name) {
      lines.push(transitLine.name)
    }

    // Add short name if different and exists
    if (transitLine.nameShort && transitLine.nameShort !== transitLine.name) {
      lines.push(transitLine.nameShort)
    }
  }

  return lines
}

// // Example usage:
// const jsonData = {
//   routes: [
//     {
//       legs: [
//         {
//           steps: [
//             {},
//             {},
//             {
//               transitDetails: {
//                 stopDetails: {
//                   arrivalStop: {
//                     name: "King's Cross Station / York Way (Stop G)",
//                     location: {
//                       latLng: {
//                         latitude: 51.531432599999995,
//                         longitude: -0.1226275,
//                       },
//                     },
//                   },
//                   arrivalTime: "2025-07-17T18:08:07Z",
//                   departureStop: {
//                     name: "Stoke Newington Town Hall",
//                     location: {
//                       latLng: {
//                         latitude: 51.56118,
//                         longitude: -0.082901,
//                       },
//                     },
//                   },
//                   departureTime: "2025-07-17T17:43:31Z",
//                 },
//                 localizedValues: {
//                   arrivalTime: {
//                     time: {
//                       text: "7:08 PM",
//                     },
//                     timeZone: "Europe/London",
//                   },
//                   departureTime: {
//                     time: {
//                       text: "6:43 PM",
//                     },
//                     timeZone: "Europe/London",
//                   },
//                 },
//                 headsign: "Kings Cross",
//                 transitLine: {
//                   agencies: [
//                     {
//                       name: "Transport for London",
//                       uri: "https://tfl.gov.uk/modes/tube/",
//                     },
//                   ],
//                   name: "Northumberland Park - Kings Cross",
//                   uri: "https://tfl.gov.uk/",
//                   color: "#ce312d",
//                   nameShort: "476",
//                   textColor: "#ffffff",
//                   vehicle: {
//                     name: {
//                       text: "Bus",
//                     },
//                     type: "BUS",
//                     iconUri:
//                       "//maps.gstatic.com/mapfiles/transit/iw2/6/bus2.png",
//                     localIconUri:
//                       "//maps.gstatic.com/mapfiles/transit/iw2/6/uk-london-bus.png",
//                   },
//                 },
//                 stopCount: 19,
//               },
//             },
//             {},
//             {},
//             {},
//             {},
//           ],
//         },
//       ],
//     },
//   ],
// }

// // Parse the route
// const transitSteps = parseTransitRoute(jsonData)
// console.log(transitSteps)
