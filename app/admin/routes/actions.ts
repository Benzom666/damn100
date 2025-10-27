"use server"

import { createClient } from "@/lib/supabase/server"
import { optimizeRouteNearestNeighbor, optimize2Opt } from "@/lib/routing"
import { optimizeWithHereTourPlanning } from "@/lib/here/tour-planning"
import { buildHereProblemV3, buildMultiVehicleProblemV3 } from "@/lib/here/build-problem-v3"
import type { Order, VehicleConfig, Depot } from "@/lib/here/build-problem-v3"
import { ensureOrderCoordinates } from "@/lib/ensure-coords"
import { revalidatePath } from "next/cache"
import type { OptimizationConfig } from "./create-route-dialog"
import { clusterOrders } from "@/lib/clustering"
import { env } from "@/lib/env"
import { recalcRouteMetrics } from "./metrics"

// Helper function to parse warehouse location
function parseWarehouseLocation(location: string): Depot | null {
  // Try to parse as "lat,lng"
  const coords = location.split(",").map((s) => Number.parseFloat(s.trim()))
  if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
    return {
      lat: coords[0],
      lng: coords[1],
    }
  }
  return null
}

export async function createRoute(
  name: string,
  orderIds: string[],
  driverId: string | null,
  use2Opt: boolean,
  optimizationConfig?: OptimizationConfig,
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  if (orderIds.length === 0) {
    throw new Error("No orders selected")
  }

  const { data: fetchedOrders } = await supabase.from("orders").select("*").in("id", orderIds)

  if (!fetchedOrders || fetchedOrders.length === 0) {
    throw new Error("No orders found")
  }

  console.log("[v0] Ensuring all orders have coordinates...")
  const { orders, failed } = await ensureOrderCoordinates(fetchedOrders)

  if (failed.length > 0) {
    console.warn(`[v0] Failed to geocode ${failed.length} orders:`, failed)
  }

  const validOrders = orders.filter((o) => o.latitude && o.longitude)

  if (validOrders.length === 0) {
    throw new Error("No orders with valid coordinates")
  }

  let depot: Depot | null = null
  let vehicleConfig: VehicleConfig = {
    id: driverId || "vehicle-1",
    capacity: 50,
    returnToDepot: true,
  }

  if (optimizationConfig) {
    if (optimizationConfig.useWarehouse && optimizationConfig.warehouseLocation) {
      const coords = parseWarehouseLocation(optimizationConfig.warehouseLocation)
      if (coords) {
        depot = coords
      }
    }

    vehicleConfig.returnToDepot = optimizationConfig.returnToWarehouse
    vehicleConfig.capacity = optimizationConfig.vehicleCapacity || vehicleConfig.capacity

    if (optimizationConfig.timeStart && optimizationConfig.timeEnd) {
      const today = new Date().toISOString().split("T")[0]
      vehicleConfig.shiftStart = `${today}T${optimizationConfig.timeStart}:00Z`
      vehicleConfig.shiftEnd = `${today}T${optimizationConfig.timeEnd}:00Z`
    }
  }

  if (driverId) {
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", driverId).single()

    if (profile) {
      if (!optimizationConfig?.useWarehouse && profile.depot_lat && profile.depot_lng) {
        depot = {
          lat: profile.depot_lat,
          lng: profile.depot_lng,
        }
      }

      vehicleConfig = {
        id: profile.id,
        capacity: optimizationConfig?.vehicleCapacity || profile.vehicle_capacity || 50,
        shiftStart:
          vehicleConfig.shiftStart ||
          (profile.shift_start ? `${new Date().toISOString().split("T")[0]}T${profile.shift_start}Z` : undefined),
        shiftEnd:
          vehicleConfig.shiftEnd ||
          (profile.shift_end ? `${new Date().toISOString().split("T")[0]}T${profile.shift_end}Z` : undefined),
        returnToDepot: optimizationConfig?.returnToWarehouse ?? true,
      }
    }
  }

  const orderData: Order[] = validOrders.map((o) => ({
    id: o.id,
    latitude: o.latitude!,
    longitude: o.longitude!,
    service_seconds: o.service_seconds || 120,
    quantity: o.quantity || 1,
  }))

  let optimizedRoute: string[] = []
  let usedHere = false

  try {
    const { problem, jobPlaceById } = await buildHereProblemV3(orderData, depot, vehicleConfig)

    const tours = await optimizeWithHereTourPlanning(problem, jobPlaceById, 90)

    if (tours.length > 0 && tours[0].orderedStopIds.length > 0) {
      optimizedRoute = tours[0].orderedStopIds
      usedHere = true
    }
  } catch (error) {
    console.error("[SERVER] [v0] HERE Tour Planning v3 failed, using fallback:", error)
  }

  if (!usedHere) {
    const stops = validOrders.map((o) => ({
      id: o.id,
      latitude: o.latitude!,
      longitude: o.longitude!,
    }))

    optimizedRoute = optimizeRouteNearestNeighbor(stops)

    if (use2Opt && stops.length >= 4) {
      optimizedRoute = optimize2Opt(stops, optimizedRoute)
    }
  }

  const { data: route, error: routeError } = await supabase
    .from("routes")
    .insert({
      name,
      driver_id: driverId,
      status: "draft",
      total_stops: optimizedRoute.length,
      completed_stops: 0,
    })
    .select()
    .single()

  if (routeError) throw routeError

  for (let i = 0; i < optimizedRoute.length; i++) {
    await supabase
      .from("orders")
      .update({
        route_id: route.id,
        stop_sequence: i + 1,
        status: "assigned",
      })
      .eq("id", optimizedRoute[i])
  }

  revalidatePath("/admin/routes")
  return route.id
}

export async function createMultipleRoutes(
  orderIds: string[],
  driverIds: string[],
  use2Opt: boolean,
  optimizationConfig?: OptimizationConfig,
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  if (orderIds.length === 0) {
    throw new Error("No orders selected")
  }

  if (driverIds.length === 0) {
    throw new Error("No drivers selected")
  }

  const { data: fetchedOrders } = await supabase.from("orders").select("*").in("id", orderIds)

  if (!fetchedOrders || fetchedOrders.length === 0) {
    throw new Error("No orders found")
  }

  console.log("[v0] Ensuring all orders have coordinates...")
  const { orders: geocodedOrders, failed } = await ensureOrderCoordinates(fetchedOrders)

  if (failed.length > 0) {
    console.warn(`[v0] Failed to geocode ${failed.length} orders:`, failed)
  }

  const validOrders = geocodedOrders.filter((o) => o.latitude && o.longitude)

  if (validOrders.length === 0) {
    throw new Error("No orders with valid coordinates")
  }

  if (validOrders.length > 0) {
    const sample = validOrders
      .slice(0, 3)
      .map((o) => `${o.id.slice(0, 8)}: ${o.latitude}, ${o.longitude}`)
      .join(" | ")
    console.log(`[v0] First 3 orders after geocoding: ${sample}`)
  }

  const { data: profiles } = await supabase.from("profiles").select("*").in("id", driverIds)

  if (!profiles || profiles.length === 0) {
    throw new Error("No valid drivers found")
  }

  const clusters = clusterOrders(
    validOrders.map((o) => ({
      id: o.id,
      latitude: o.latitude!,
      longitude: o.longitude!,
      city: o.city,
      state: o.state,
    })),
    profiles.length,
    env.MAX_DEPOT_DISTANCE_KM,
  )

  console.log(`[v0] Created ${clusters.length} geographic clusters for ${validOrders.length} orders`)
  clusters.forEach((cluster, i) => {
    console.log(
      `[v0] Cluster ${i}: ${cluster.orders.length} orders, centroid: ${cluster.centroid.lat.toFixed(4)}, ${cluster.centroid.lng.toFixed(4)}${cluster.city ? ` (${cluster.city})` : ""}`,
    )
  })

  const createdRouteIds: string[] = []

  for (const cluster of clusters) {
    const clusterOrderData: Order[] = cluster.orders.map((o) => {
      const fullOrder = validOrders.find((vo) => vo.id === o.id)!
      return {
        id: o.id,
        latitude: o.latitude,
        longitude: o.longitude,
        service_seconds: fullOrder.service_seconds || 120,
        quantity: fullOrder.quantity || 1,
      }
    })

    const clusterDepot: Depot = {
      lat: cluster.centroid.lat,
      lng: cluster.centroid.lng,
    }

    const driversForCluster = profiles.slice(0, Math.max(1, Math.ceil(profiles.length / clusters.length)))

    const vehicleConfigs: VehicleConfig[] = driversForCluster.map((p) => ({
      id: p.id,
      capacity: optimizationConfig?.vehicleCapacity || p.vehicle_capacity || env.ROUTE_CAPACITY,
      shiftStart:
        optimizationConfig?.timeStart && optimizationConfig?.timeEnd
          ? `${new Date().toISOString().split("T")[0]}T${optimizationConfig.timeStart}:00Z`
          : p.shift_start
            ? `${new Date().toISOString().split("T")[0]}T${p.shift_start}Z`
            : undefined,
      shiftEnd:
        optimizationConfig?.timeStart && optimizationConfig?.timeEnd
          ? `${new Date().toISOString().split("T")[0]}T${optimizationConfig.timeEnd}:00Z`
          : p.shift_end
            ? `${new Date().toISOString().split("T")[0]}T${p.shift_end}Z`
            : undefined,
      returnToDepot: optimizationConfig?.returnToWarehouse ?? true,
    }))

    let tours: Array<{
      vehicleId: string
      orderedStopIds: string[]
      jobPlaces?: Map<string, { lat: number; lng: number }>
    }> = []
    let usedHere = false

    try {
      console.log(
        `[v0] Optimizing cluster ${cluster.id} with ${clusterOrderData.length} orders and ${vehicleConfigs.length} vehicles`,
      )

      const { problem, jobPlaceById } = await buildMultiVehicleProblemV3(clusterOrderData, clusterDepot, vehicleConfigs)

      const hereTours = await optimizeWithHereTourPlanning(problem, jobPlaceById, 120)

      if (hereTours.length > 0) {
        tours = hereTours
        usedHere = true
        console.log(`[v0] HERE optimization succeeded for cluster ${cluster.id}: ${hereTours.length} tours`)
      }
    } catch (error) {
      console.error(`[v0] HERE Tour Planning v3 failed for cluster ${cluster.id}, using fallback:`, error)
    }

    if (!usedHere) {
      const stops = clusterOrderData.map((o) => ({
        id: o.id,
        latitude: o.latitude,
        longitude: o.longitude,
      }))

      const ordersPerDriver = Math.ceil(stops.length / driversForCluster.length)

      for (let i = 0; i < driversForCluster.length; i++) {
        const driverStops = stops.slice(i * ordersPerDriver, (i + 1) * ordersPerDriver)

        if (driverStops.length > 0) {
          let optimized = optimizeRouteNearestNeighbor(driverStops)

          if (use2Opt && driverStops.length >= 4) {
            optimized = optimize2Opt(driverStops, optimized)
          }

          tours.push({
            vehicleId: driversForCluster[i].id,
            orderedStopIds: optimized,
          })
        }
      }
    }

    for (const tour of tours) {
      if (tour.orderedStopIds.length === 0) continue

      const deliveryStopIds = tour.orderedStopIds.filter((jobId) => {
        if (jobId === "departure" || jobId === "arrival") return false
        return orderIds.includes(jobId)
      })

      if (deliveryStopIds.length === 0) continue

      const baseVehicleId = tour.vehicleId.split("_")[0]
      const driverId = baseVehicleId === "default-vehicle" ? null : baseVehicleId

      const routeName = cluster.city
        ? `${cluster.city} - Route ${createdRouteIds.length + 1}`
        : `Route ${createdRouteIds.length + 1}`

      const { data: route, error: routeError } = await supabase
        .from("routes")
        .insert({
          name: routeName,
          driver_id: driverId,
          status: "draft",
          total_stops: deliveryStopIds.length,
          completed_stops: 0,
        })
        .select()
        .single()

      if (routeError) throw routeError

      for (let i = 0; i < deliveryStopIds.length; i++) {
        await supabase
          .from("orders")
          .update({
            route_id: route.id,
            stop_sequence: i + 1,
            status: "assigned",
          })
          .eq("id", deliveryStopIds[i])
      }

      createdRouteIds.push(route.id)
      console.log(`[v0] Created route ${route.id} with ${deliveryStopIds.length} stops for cluster ${cluster.id}`)
    }
  }

  console.log(`[v0] Created ${createdRouteIds.length} total routes from ${clusters.length} clusters`)

  revalidatePath("/admin/routes")
  return createdRouteIds
}

export async function updateRouteStatus(routeId: string, status: "draft" | "active" | "completed") {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { error } = await supabase.from("routes").update({ status }).eq("id", routeId)

  if (error) throw error

  if (status === "active") {
    await supabase.from("orders").update({ status: "in_transit" }).eq("route_id", routeId)
  }

  revalidatePath("/admin/routes")
  revalidatePath("/admin/dispatch")
}

export async function deleteRoute(routeId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  await supabase
    .from("orders")
    .update({ route_id: null, stop_sequence: null, status: "pending" })
    .eq("route_id", routeId)

  const { error } = await supabase.from("routes").delete().eq("id", routeId)

  if (error) throw error

  revalidatePath("/admin/routes")
}

export async function assignDriver(routeId: string, driverId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { error } = await supabase.from("routes").update({ driver_id: driverId }).eq("id", routeId)

  if (error) throw error

  revalidatePath("/admin/routes")
}

export async function updateRoute(
  routeId: string,
  updates: {
    name?: string
    driver_id?: string | null
    status?: "draft" | "active" | "completed"
  },
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  console.log("[v0] Updating route", routeId, "with", updates)

  const { error } = await supabase.from("routes").update(updates).eq("id", routeId)

  if (error) {
    console.error("[v0] Error updating route:", error)
    throw error
  }

  revalidatePath("/admin/routes")
  revalidatePath(`/admin/routes/${routeId}`)
  return { success: true }
}

export async function recalcRouteMetricsAction(routeId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  // Check if user is admin
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    throw new Error("Unauthorized: Admin only")
  }

  console.log("[v0] [METRICS] Recalculating metrics for route:", routeId)

  const serviceTimePerStopSec = Number(process.env.NEXT_PUBLIC_SERVICE_TIME_PER_STOP_SEC) || 90

  const metrics = await recalcRouteMetrics(routeId, { serviceTimePerStopSec })

  if (!metrics) {
    throw new Error("Failed to calculate metrics")
  }

  revalidatePath(`/admin/routes/${routeId}`)
  revalidatePath("/admin/routes")

  return metrics
}
