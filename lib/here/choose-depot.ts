import { geocodeHere } from "../geocode-here"

type Coords = { lat: number; lng: number }

export interface DepotChoice {
  coords: Coords
  source: "env" | "geocoded" | "orders-centroid"
}

export interface Order {
  latitude?: number
  longitude?: number
  lat?: number
  lng?: number
}

function haversineKm(a: Coords, b: Coords): number {
  const R = 6371 // Earth radius in km
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const h = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function centroid(coords: Coords[]): Coords {
  if (coords.length === 0) {
    throw new Error("Cannot calculate centroid of empty array")
  }
  const n = coords.length
  return {
    lat: coords.reduce((sum, c) => sum + c.lat, 0) / n,
    lng: coords.reduce((sum, c) => sum + c.lng, 0) / n,
  }
}

/**
 * Choose depot location with priority: env vars > geocoded address > orders centroid
 * @param orders - List of orders with geocoded coordinates
 * @returns Depot choice with coords and source indicator
 */
export async function chooseDepot(orders: Order[]): Promise<DepotChoice> {
  // Extract valid coordinates from orders (support both latitude/longitude and lat/lng)
  const pts: Coords[] = orders
    .map((o) => {
      const lat = o.latitude ?? o.lat
      const lng = o.longitude ?? o.lng
      return lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat: Number(lat), lng: Number(lng) }
        : null
    })
    .filter((p): p is Coords => p !== null)

  if (pts.length > 0) {
    const sample = pts
      .slice(0, 3)
      .map((p) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`)
      .join(" | ")
    console.log(`[v0] chooseDepot: first 3 coords from orders: ${sample}`)
  }

  // 1) Explicit env coords win
  const envLat = Number(process.env.DEPOT_LAT)
  const envLng = Number(process.env.DEPOT_LNG)
  if (Number.isFinite(envLat) && Number.isFinite(envLng)) {
    console.log(`[v0] Using depot from env: ${envLat}, ${envLng}`)
    return { coords: { lat: envLat, lng: envLng }, source: "env" }
  }

  // 2) Geocode DEPOT_ADDRESS if present (with Ottawa bias)
  const depotAddress = process.env.DEPOT_ADDRESS
  if (depotAddress) {
    try {
      const result = await geocodeHere(depotAddress)
      if (result) {
        console.log(`[v0] Using geocoded depot: ${result.lat}, ${result.lng} - ${depotAddress}`)
        return { coords: { lat: result.lat, lng: result.lng }, source: "geocoded" }
      }
    } catch (err) {
      console.warn(`[v0] Failed to geocode depot address: ${depotAddress}`, err)
    }
  }

  // 3) Fallback: centroid of geocoded orders
  if (pts.length === 0) {
    throw new Error(
      "Cannot determine depot: no orders with valid coordinates and no DEPOT_LAT/LNG or DEPOT_ADDRESS set",
    )
  }

  const c = centroid(pts)
  console.log(`[v0] Using orders centroid as depot: ${c.lat}, ${c.lng} (from ${pts.length} geocoded orders)`)
  return { coords: c, source: "orders-centroid" }
}

/**
 * Validate that depot is not too far from all jobs
 * @param depot - Depot choice
 * @param orders - List of orders
 * @param maxDistanceKm - Maximum allowed distance (default 80km)
 * @returns Validated depot (may be adjusted to centroid if too far)
 */
export function clampDepotToOrders(depot: DepotChoice, orders: Order[], maxDistanceKm = 80): DepotChoice {
  // Extract valid coordinates from orders
  const pts: Coords[] = orders
    .map((o) => {
      const lat = o.latitude ?? o.lat
      const lng = o.longitude ?? o.lng
      return lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat: Number(lat), lng: Number(lng) }
        : null
    })
    .filter((p): p is Coords => p !== null)

  if (pts.length === 0) return depot

  const farthest = Math.max(...pts.map((p) => haversineKm(depot.coords, p)))

  if (farthest > maxDistanceKm) {
    console.warn(
      `[v0] Depot too far from jobs (${farthest.toFixed(1)}km > ${maxDistanceKm}km). Using orders centroid instead.`,
    )
    const c = centroid(pts)
    return { coords: c, source: "orders-centroid" }
  }

  return depot
}
