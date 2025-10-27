// Cache for segment shapes to avoid redundant API calls
const segmentCache = new Map<string, string>()

interface LatLng {
  lat: number
  lng: number
}

/**
 * Fetch road-snapped polyline between two points using HERE Routing v8
 * Returns the encoded flexible polyline string for use with H.geo.LineString.fromFlexiblePolyline()
 * Results are cached by "lat,lng|lat,lng" key for instant re-opens
 */
export async function segmentShape(a: LatLng, b: LatLng, apiKey: string): Promise<string | null> {
  const cacheKey = `${a.lat},${a.lng}|${b.lat},${b.lng}`

  // Check cache first
  if (segmentCache.has(cacheKey)) {
    return segmentCache.get(cacheKey)!
  }

  try {
    const url = new URL("https://router.hereapi.com/v8/routes")
    url.searchParams.set("transportMode", "car")
    url.searchParams.set("origin", `${a.lat},${a.lng}`)
    url.searchParams.set("destination", `${b.lat},${b.lng}`)
    url.searchParams.set("return", "polyline,summary")
    url.searchParams.set("apiKey", apiKey)

    const response = await fetch(url.toString())

    if (!response.ok) {
      console.warn(`[v0] Routing API error ${response.status}, falling back to straight line`)
      return null
    }

    const data = await response.json()
    const polyline = data.routes?.[0]?.sections?.[0]?.polyline

    if (!polyline) {
      console.warn("[v0] No polyline in response, falling back to straight line")
      return null
    }

    // Cache the encoded polyline
    segmentCache.set(cacheKey, polyline)

    return polyline
  } catch (error) {
    console.error("[v0] Segment shape error:", error)
    return null // Fallback to straight line
  }
}

export function isValidLatLng(p: { lat: number; lng: number }): boolean {
  return (
    Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180
  )
}

export function looksLikeSwapped(p: { lat: number; lng: number }): boolean {
  return Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180
}
