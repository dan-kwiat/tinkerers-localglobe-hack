"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useParams } from "next/navigation"
import { TransitRouteVisualization } from "@/components/TransitRouteVisualization"

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

export default function Page() {
  const [commuteFrom, setCommuteFrom] = useState("")
  const [commuteTo, setCommuteTo] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [directionsA, setDirectionsA] = useState<unknown>(null)
  const [directionsB, setDirectionsB] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const { routeId } = useParams<{ routeId: string }>()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setDirectionsA(null)
    setDirectionsB(null)

    try {
      const params = new URLSearchParams({
        commuteFrom,
        commuteTo,
        routeId,
      })

      const response = await fetch(`/api/directions?${params}`)

      if (!response.ok) {
        try {
          const text = await response.text()
          throw new Error(text)
        } catch {
          throw new Error("Failed to get directions")
        }
      }

      const { directionsA, directionsB } = await response.json()
      setDirectionsA(directionsA)
      setDirectionsB(directionsB)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center">
      {!directionsA || !directionsB ? (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Find meeting locations</CardTitle>
            <CardDescription>
              Enter your commute to find optimal meeting spots along the way
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="commuteFrom">From</Label>
                  <Input
                    id="commuteFrom"
                    placeholder="Stoke Newington"
                    value={commuteFrom}
                    onChange={(e) => setCommuteFrom(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="commuteTo">To</Label>
                  </div>
                  <Input
                    id="commuteTo"
                    placeholder="King's Cross"
                    value={commuteTo}
                    onChange={(e) => setCommuteTo(e.target.value)}
                    required
                  />
                </div>
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              onClick={handleSubmit}
            >
              {isLoading ? "Finding directions..." : "Get directions"}
            </Button>
            {error && <p className="w-full text-sm text-red-600">{error}</p>}
          </CardFooter>
        </Card>
      ) : (
        <div className="w-full max-w-4xl mx-auto p-4">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <TransitRouteVisualization 
              routes={[
                { steps: Array.isArray(directionsA) ? directionsA as TransitStep[] : [], label: "Shared Route", color: "#3498db" },
                { steps: Array.isArray(directionsB) ? directionsB as TransitStep[] : [], label: "Your Route", color: "#e74c3c" }
              ]} 
            />
          </div>
          <div className="mt-6 text-center">
            <Button className="px-8 py-3 text-lg">
              Find a cafe
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
