// lib/geocode-here.ts
// Global geocoding with HERE API - uses free-text queries with country bias

"use server"

export interface GeocodeResult {
  lat: number
  lng: number
  label?: string
  quality?: string
}

/**
 * Normalize address string (fix smart quotes, trim)
 */
function normalizeAddr(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'") // curly single quotes → straight
    .replace(/[\u201C\u201D]/g, '"') // curly double quotes → straight
    .trim()
}

/**
 * Geocode a single address using HERE Geocoding API v1 with free-text query
 * Biased to Ottawa, Canada for delivery precision
 */
export async function geocodeAddress(
  fullAddress: string,
  apiKey: string,
  bias?: { lat: number; lng: number },
): Promise<GeocodeResult | null> {
  if (!apiKey) {
    console.error("[v0] HERE_API_KEY not configured")
    return null
  }

  if (!fullAddress || fullAddress.trim().length === 0) {
    console.warn("[v0] Empty address provided for geocoding")
    return null
  }

  try {
    const q = normalizeAddr(fullAddress)
    const url = new URL("https://geocode.search.hereapi.com/v1/geocode")
    url.searchParams.set("q", q)
    url.searchParams.set("apiKey", apiKey)

    url.searchParams.set("in", "countryCode:CAN")
    if (bias) {
      url.searchParams.set("at", `${bias.lat},${bias.lng}`)
    }

    const response = await fetch(url.toString(), { cache: "no-store" })

    if (!response.ok) {
      console.error(`[v0] Geocoding error ${response.status}`)
      return null
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      console.warn("[v0] No geocoding results found for:", q)
      return null
    }

    const result = data.items[0]
    const best = result.access?.[0] ?? result.route?.[0] ?? result.position

    if (!best || !Number.isFinite(best.lat) || !Number.isFinite(best.lng)) {
      console.warn("[v0] Invalid coordinates in geocoding result:", result)
      return null
    }

    return {
      lat: best.lat,
      lng: best.lng,
      label: result.address?.label ?? q,
      quality: result.resultType,
    }
  } catch (error) {
    console.error("[v0] Geocoding error:", error)
    return null
  }
}

/**
 * Geocode a single address with API key from environment
 * Convenience wrapper around geocodeAddress
 */
export async function geocodeHere(fullAddress: string): Promise<GeocodeResult | null> {
  const apiKey = process.env.HERE_API_KEY
  if (!apiKey) {
    console.error("[v0] HERE_API_KEY not configured")
    return null
  }

  // Default Ottawa bias for depot geocoding
  const ottawaBias = { lat: 45.4215, lng: -75.6972 }

  return geocodeAddress(fullAddress, apiKey, ottawaBias)
}

/**
 * Geocode multiple addresses with retry and rate limiting
 */
export async function geocodeBatch(
  addresses: string[],
  apiKey: string,
  options: { batchSize?: number; retries?: number; bias?: { lat: number; lng: number } } = {},
): Promise<Array<{ result: GeocodeResult | null; error?: string }>> {
  const { batchSize = 25, retries = 2, bias } = options
  const results: Array<{ result: GeocodeResult | null; error?: string }> = []

  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize)
    console.log(`[v0] Geocoding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(addresses.length / batchSize)}...`)

    const batchResults = await Promise.all(
      batch.map(async (addr) => {
        let lastError: string | undefined

        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            const result = await geocodeAddress(addr, apiKey, bias)
            if (result) {
              return { result, error: undefined }
            }
            lastError = "No results found"
          } catch (error) {
            lastError = error instanceof Error ? error.message : "Geocoding failed"
            if (attempt < retries) {
              await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt)))
            }
          }
        }

        return { result: null, error: lastError || "Geocoding failed" }
      }),
    )

    results.push(...batchResults)

    // Rate limiting between batches
    if (i + batchSize < addresses.length) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  return results
}
