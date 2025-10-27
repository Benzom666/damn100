// HERE Routing v8 API for polylines and ETAs

interface RouteCoordinate {
  lat: number
  lng: number
}

interface RoutePolyline {
  polyline: string // Flexible polyline encoded string
  distance: number // meters
  duration: number // seconds
}

interface RouteSection {
  distance: number
  duration: number
  summary?: string
}

interface RoutingResult {
  polylines: RoutePolyline[]
  sections: RouteSection[]
  totalDistance: number
  totalDuration: number
}

export async function getRoutePolylineInOrder(coords: RouteCoordinate[]): Promise<RoutingResult | null> {
  try {
    const apiKey = process.env.HERE_API_KEY

    if (!apiKey) {
      console.error("HERE_API_KEY not configured")
      return null
    }

    if (coords.length < 2) {
      return null
    }

    // Build origin, destination, and via points
    const origin = `${coords[0].lat},${coords[0].lng}`
    const destination = `${coords[coords.length - 1].lat},${coords[coords.length - 1].lng}`

    // Via points are all intermediate stops
    const viaPoints = coords.slice(1, -1).map((c) => `${c.lat},${c.lng}`)

    // Build URL
    const url = new URL("https://router.hereapi.com/v8/routes")
    url.searchParams.set("transportMode", "car")
    url.searchParams.set("origin", origin)
    url.searchParams.set("destination", destination)

    // Add via points
    viaPoints.forEach((via) => {
      url.searchParams.append("via", via)
    })

    url.searchParams.set("return", "polyline,summary,actions")
    url.searchParams.set("apiKey", apiKey)

    const response = await fetch(url.toString())

    if (!response.ok) {
      console.error(`HERE Routing API error: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (!data.routes || data.routes.length === 0) {
      return null
    }

    const route = data.routes[0]
    const polylines: RoutePolyline[] = []
    const sections: RouteSection[] = []
    let totalDistance = 0
    let totalDuration = 0

    // Extract sections and polylines
    if (route.sections) {
      for (const section of route.sections) {
        polylines.push({
          polyline: section.polyline,
          distance: section.summary?.length || 0,
          duration: section.summary?.duration || 0,
        })

        sections.push({
          distance: section.summary?.length || 0,
          duration: section.summary?.duration || 0,
          summary: section.summary?.text,
        })

        totalDistance += section.summary?.length || 0
        totalDuration += section.summary?.duration || 0
      }
    }

    return {
      polylines,
      sections,
      totalDistance,
      totalDuration,
    }
  } catch (error) {
    console.error("HERE Routing error:", error)
    return null
  }
}

// Decode flexible polyline (simplified - for production use HERE's official decoder)
export function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  // This is a placeholder - in production, use HERE's official flexible polyline decoder
  // or include the @here/flexible-polyline package
  // For now, return empty array - the map will still show markers
  console.warn("Polyline decoding not implemented - install @here/flexible-polyline")
  return []
}
