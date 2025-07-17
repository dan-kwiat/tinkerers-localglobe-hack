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

export default function Page() {
  const [commuteFrom, setCommuteFrom] = useState("")
  const [commuteTo, setCommuteTo] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const params = new URLSearchParams({
        commuteFrom,
        commuteTo,
      })

      const response = await fetch(`/api/encode?${params}`)

      if (!response.ok) {
        try {
          const text = await response.text()
          throw new Error(text)
        } catch {
          throw new Error("Failed to generate a link")
        }
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Enter your morning commute</CardTitle>
          <CardDescription>
            Type place names as if you were searching Google maps
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
            {isLoading ? "Generating..." : "Generate unique link"}
          </Button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
          {result && typeof result === 'object' && result !== null && 'commuteFrom' in result && 'commuteTo' in result ? (
            <div className="mt-4 w-full text-sm space-y-2">
              <p>Your unique link is:</p>
              <p>
                <a
                  className="underline font-bold"
                  href={`${process.env.NEXT_PUBLIC_BASE_URL}/c/${(result as Record<string, { geohash: string }>).commuteFrom.geohash}-${(result as Record<string, { geohash: string }>).commuteTo.geohash}`}
                >
                  {`${process.env.NEXT_PUBLIC_BASE_URL}/c/${(result as Record<string, { geohash: string }>).commuteFrom.geohash}-${(result as Record<string, { geohash: string }>).commuteTo.geohash}`}
                </a>
              </p>
              <p>
                Share this with someone you want to have a morning meeting with.
              </p>
            </div>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  )
}
