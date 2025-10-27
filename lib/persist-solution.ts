// lib/persist-solution.ts
// Persist HERE Tour Planning solution to database

"use server"

import { createClient } from "@/lib/supabase/server"

export interface TourSolution {
  vehicleId: string
  orderedStopIds: string[]
  totalDistance?: number
  totalTime?: number
}

export async function persistRouteSolution(
  routeName: string,
  tours: TourSolution[],
  depot: { lat: number; lng: number },
  rawSolution: any,
  driverId?: string,
): Promise<string[]> {
  const supabase = await createClient()
  const routeIds: string[] = []

  for (let tourIndex = 0; tourIndex < tours.length; tourIndex++) {
    const tour = tours[tourIndex]

    // Create route
    const { data: route, error: routeError } = await supabase
      .from("routes")
      .insert({
        name: tours.length > 1 ? `${routeName} - Vehicle ${tourIndex + 1}` : routeName,
        status: "ready",
        driver_id: driverId || null,
        total_distance_m: tour.totalDistance,
        total_duration_s: tour.totalTime,
        vehicle_count: 1,
        depot_lat: depot.lat,
        depot_lng: depot.lng,
        total_stops: tour.orderedStopIds.length,
        completed_stops: 0,
        raw_solution_json: rawSolution,
      })
      .select()
      .single()

    if (routeError || !route) {
      console.error("[v0] Failed to create route:", routeError)
      continue
    }

    routeIds.push(route.id)

    // Fetch order details for stops
    const { data: orders } = await supabase
      .from("orders")
      .select("id, latitude, longitude")
      .in("id", tour.orderedStopIds)

    if (!orders) continue

    // Create route_stops and update orders
    for (let i = 0; i < tour.orderedStopIds.length; i++) {
      const orderId = tour.orderedStopIds[i]
      const order = orders.find((o) => o.id === orderId)

      if (!order || !order.latitude || !order.longitude) continue

      // Create stop
      await supabase.from("route_stops").insert({
        route_id: route.id,
        order_id: orderId,
        sequence: i + 1,
        lat: order.latitude,
        lng: order.longitude,
      })

      // Update order
      await supabase
        .from("orders")
        .update({
          route_id: route.id,
          stop_sequence: i + 1,
          status: "assigned",
        })
        .eq("id", orderId)
    }
  }

  return routeIds
}
