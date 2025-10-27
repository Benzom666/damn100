export interface GeocodingResult {
  latitude: number
  longitude: number
  formattedAddress?: string
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function geocodeSingle(
  address: string,
  city?: string,
  state?: string,
  zip?: string,
  retries = 2,
): Promise<GeocodingResult | null> {
  const fullAddress = [address, city, state, zip].filter(Boolean).join(", ")
  const apiKey = process.env.HERE_API_KEY

  if (!apiKey) {
    console.error("[v0] HERE_API_KEY not configured")
    return null
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(fullAddress)}&apiKey=${apiKey}`
      const response = await fetch(url, { cache: "no-store" })

      if (response.status === 429) {
        // Rate limited - exponential backoff
        const backoff = Math.min(1000 * Math.pow(2, attempt), 8000)
        console.warn(`[v0] Rate limited, waiting ${backoff}ms...`)
        await sleep(backoff)
        continue
      }

      if (response.status >= 500 && attempt < retries) {
        // Server error - retry with backoff
        const backoff = 500 * Math.pow(2, attempt)
        console.warn(`[v0] Server error ${response.status}, retrying in ${backoff}ms...`)
        await sleep(backoff)
        continue
      }

      if (!response.ok) {
        console.error(`[v0] Geocoding error ${response.status} for: ${fullAddress}`)
        return null
      }

      const data = await response.json()

      if (!data.items || data.items.length === 0) {
        console.warn(`[v0] No geocoding results for: ${fullAddress}`)
        return null
      }

      const result = data.items[0]
      return {
        latitude: result.position.lat,
        longitude: result.position.lng,
        formattedAddress: result.address?.label || fullAddress,
      }
    } catch (error) {
      if (attempt === retries) {
        console.error(`[v0] Geocoding failed after ${retries + 1} attempts:`, error)
        return null
      }
      await sleep(500 * Math.pow(2, attempt))
    }
  }

  return null
}

export async function geocodeAddress(
  address: string,
  city?: string,
  state?: string,
  zip?: string,
): Promise<GeocodingResult | null> {
  return geocodeSingle(address, city, state, zip)
}

export async function geocodeBatch(
  addresses: Array<{ address: string; city?: string; state?: string; zip?: string }>,
  batchSize = 25,
): Promise<Array<GeocodingResult | null>> {
  const results: Array<GeocodingResult | null> = []

  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize)
    console.log(`[v0] Geocoding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(addresses.length / batchSize)}...`)

    const batchResults = await Promise.all(
      batch.map((addr) => geocodeSingle(addr.address, addr.city, addr.state, addr.zip)),
    )

    results.push(...batchResults)

    // Rate limiting between batches
    if (i + batchSize < addresses.length) {
      await sleep(200)
    }
  }

  return results
}
