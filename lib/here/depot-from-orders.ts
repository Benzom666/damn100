/**
 * Pure, stateless depot centroid calculator
 * Takes geocoded orders and returns {coords: {lat, lng}, source: string} without any caching or side effects
 */

export function depotFromOrders(orders: Array<{ latitude: number | string; longitude: number | string }>) {
  const pts = orders
    .map((o) => ({ lat: +o.latitude, lng: +o.longitude }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))

  if (pts.length === 0) {
    throw new Error("No valid points for depot centroid")
  }

  const sum = pts.reduce((a, p) => ({ lat: a.lat + p.lat, lng: a.lng + p.lng }), { lat: 0, lng: 0 })
  const depot = { lat: sum.lat / pts.length, lng: sum.lng / pts.length }

  console.log(`[v0] Computed depot centroid: ${depot.lat}, ${depot.lng} from ${pts.length} points`)
  console.log(
    `[v0] First 3 points: ${pts
      .slice(0, 3)
      .map((p) => `${p.lat},${p.lng}`)
      .join(" | ")}`,
  )
  console.log(
    `[v0] Last 3 points: ${pts
      .slice(-3)
      .map((p) => `${p.lat},${p.lng}`)
      .join(" | ")}`,
  )
  console.log(`[v0] All points: ${pts.map((p) => `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`).join(" | ")}`)

  if (!(depot.lat > 45.2 && depot.lat < 45.6 && depot.lng > -76 && depot.lng < -75.5)) {
    console.warn("[v0] Depot sanity guard tripped; using first point instead", depot)
    return {
      coords: { lat: pts[0].lat, lng: pts[0].lng },
      source: "first-point-fallback" as const,
    }
  }

  return {
    coords: { lat: depot.lat, lng: depot.lng },
    source: "centroid" as const,
  }
}
