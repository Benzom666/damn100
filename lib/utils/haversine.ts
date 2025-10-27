/**
 * Calculate distance between two lat/lng points using Haversine formula
 * @returns distance in kilometers
 */
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const a1 = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2
  return 2 * R * Math.asin(Math.sqrt(a1))
}
