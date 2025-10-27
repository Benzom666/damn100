// lib/ensure-coords.ts
// Ensure orders have coordinates before optimization

"use server"

import { createClient } from "@/lib/supabase/server"
import { geocodeAddress } from "@/lib/geocode-here"

export interface OrderWithCoords {
  id: string
  latitude: number
  longitude: number
  [key: string]: any
}

/**
 * Ensure all orders have coordinates, geocoding missing ones
 * Returns updated orders array with geocoded coordinates
 * Mutates the input orders array to update coordinates in-place
 */
export async function ensureOrderCoordinates(orders: any[]): Promise<{
  orders: OrderWithCoords[]
  failed: Array<{ orderId: string; error: string }>
}> {
  const supabase = await createClient()
  const apiKey = process.env.HERE_API_KEY

  if (!apiKey) {
    throw new Error("HERE_API_KEY not configured")
  }

  const failed: Array<{ orderId: string; error: string }> = []

  const looksGridy = (v: number) => {
    if (!Number.isFinite(v)) return false
    const decimal = Math.abs(v - Math.floor(v))
    const lastDigit = Math.round((decimal * 100000) % 10)
    return lastDigit === 0
  }

  const needsRefresh = (o: any) =>
    !Number.isFinite(o.latitude) || !Number.isFinite(o.longitude) || looksGridy(o.latitude) || looksGridy(o.longitude)

  const ordersToGeocode = orders.filter(needsRefresh)

  if (ordersToGeocode.length === 0) {
    console.log("[v0] All orders already have valid coordinates")
    return { orders: orders as OrderWithCoords[], failed: [] }
  }

  console.log(
    `[v0] Geocoding ${ordersToGeocode.length} orders (including ${ordersToGeocode.filter((o) => looksGridy(o.latitude)).length} legacy grid coords)...`,
  )

  const ottawaBias = { lat: 45.4215, lng: -75.6972 }

  for (const o of ordersToGeocode) {
    const fullAddress =
      o.full_address ||
      o.delivery_address ||
      [o.address_line1 || o.address, o.city, o.state_province || o.state, o.postal_code || o.zip, o.country]
        .filter(Boolean)
        .join(", ")

    if (!fullAddress || fullAddress.trim().length === 0) {
      const error = "No address to geocode"
      failed.push({ orderId: o.id, error })
      console.warn(`[v0] ${error}:`, o.id)
      continue
    }

    const g = await geocodeAddress(fullAddress, apiKey, ottawaBias)

    if (!g) {
      const error = "Geocoding failed - no results"
      failed.push({ orderId: o.id, error })
      console.warn(`[v0] ${error}:`, o.id, fullAddress)
      continue
    }

    o.latitude = g.lat
    o.longitude = g.lng

    try {
      const { error: dbError } = await supabase
        .from("orders")
        .update({
          latitude: g.lat,
          longitude: g.lng,
        })
        .eq("id", o.id)

      if (dbError) {
        console.warn(`[v0] DB update failed (non-fatal):`, o.id, dbError.message)
      }
    } catch (e) {
      console.warn(`[v0] DB update exception (non-fatal):`, o.id, String(e))
    }

    console.log(`[v0] Geocoded ${o.id}: ${g.lat.toFixed(5)}, ${g.lng.toFixed(5)} - ${g.label}`)
  }

  console.log(
    "[v0] First 3 geocoded coords:",
    orders
      .slice(0, 3)
      .map((o) => `${o.id.slice(0, 8)}: ${o.latitude?.toFixed(5)}, ${o.longitude?.toFixed(5)}`)
      .join(" | "),
  )

  const stillMissing = orders.filter((o) => !Number.isFinite(o.latitude) || !Number.isFinite(o.longitude))
  if (stillMissing.length > 0) {
    throw new Error(
      `${stillMissing.length} orders still lack geocoded coords after geocoding: ${stillMissing.map((o) => `${o.id} (${o.full_address || o.delivery_address || "no address"})`).join(", ")}`,
    )
  }

  if (failed.length > 0) {
    console.warn(`[v0] Failed to geocode ${failed.length} orders (continuing with others):`, JSON.stringify(failed))
  }

  return {
    orders: orders as OrderWithCoords[],
    failed,
  }
}
