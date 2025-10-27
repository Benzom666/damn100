// lib/here/build-problem-v3.ts
// HERE Tour Planning v3 API schema builder
// Follows the official 2025 v3 structure with correct tasks.deliveries[] format

import { depotFromOrders } from "./depot-from-orders"
import { env } from "@/lib/env"

export interface Depot {
  lat: number
  lng: number
}

export interface Order {
  id: string
  latitude: number
  longitude: number
  service_seconds?: number
  service_minutes?: number
  quantity?: number
  window_start?: string | Date
  window_end?: string | Date
  tw_start?: string | Date
  tw_end?: string | Date
}

export interface VehicleConfig {
  id: string
  capacity?: number
  shiftStart?: string // ISO string
  shiftEnd?: string // ISO string
  returnToDepot?: boolean
}

export interface BuildProblemResult {
  problem: any
  jobPlaceById: Map<string, { lat: number; lng: number }>
}

const SOFT_WINDOWS = true // ← force true to prove routes work without time constraints

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371 // Earth radius in km
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const h = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function toISOZLocal(x: string | Date): string {
  const d = typeof x === "string" ? new Date(x) : x
  // Treat d as *local clock* and encode as Z by subtracting local offset
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString()
}

function overlaps(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date): boolean {
  return aFrom < bTo && bFrom < aTo
}

function makeDeliveryTask(o: Order, softWindows: boolean) {
  const place: any = {
    location: { lat: o.latitude, lng: o.longitude },
    duration: o.service_seconds || (o.service_minutes ? o.service_minutes * 60 : 300),
  }

  // Only attach times when softWindows is false AND both windows are present and valid
  if (!softWindows && (o.window_start || o.tw_start) && (o.window_end || o.tw_end)) {
    const windowStart = o.window_start || o.tw_start
    const windowEnd = o.window_end || o.tw_end
    const from = toISOZLocal(windowStart)
    const to = toISOZLocal(windowEnd)
    if (new Date(from) < new Date(to)) {
      place.times = [{ from, to }]
    }
  }

  return { places: [place], demand: [o.quantity || 1] }
}

function loc(coords: { lat: number; lng: number }): { lat: number; lng: number } {
  return { lat: coords.lat, lng: coords.lng }
}

/**
 * Builds a HERE Tour Planning v3 problem payload
 * @param orders - List of delivery orders with coordinates
 * @param depot - Warehouse/depot location for start/end (optional, will be calculated if not provided)
 * @param vehicle - Vehicle configuration with capacity, shifts, constraints
 * @returns Valid HERE Tour Planning v3 problem object and job place lookup map
 */
export async function buildHereProblemV3(
  orders: Order[],
  depot: Depot | null,
  vehicle: VehicleConfig,
): Promise<BuildProblemResult> {
  let depotChoice
  if (depot && depot.lat && depot.lng) {
    depotChoice = { coords: { lat: depot.lat, lng: depot.lng }, source: "provided" as const }
    console.log(`[v0] Using provided depot: ${depot.lat}, ${depot.lng}`)
  } else {
    depotChoice = await depotFromOrders(orders)
  }

  const depotLocation = loc(depotChoice.coords)

  console.log(`[v0] depot:`, depotLocation, `(source: ${depotChoice.source})`)
  if (orders.length > 0) {
    const firstJobLoc = { lat: orders[0].latitude, lng: orders[0].longitude }
    const distanceKm = km(depotLocation, firstJobLoc)
    console.log(`[v0] depot->first distance (km):`, distanceKm.toFixed(2))
  }

  const maxStartDistKm = env.MAX_DEPOT_DISTANCE_KM
  const farJobs = orders.filter((o) => {
    const loc = { lat: o.latitude, lng: o.longitude }
    return km(depotLocation, loc) > maxStartDistKm
  })
  if (farJobs.length > 0) {
    console.warn(`[v0] ${farJobs.length} jobs are >${maxStartDistKm}km from depot and may be unassigned`)
  }

  const startLocal = new Date()
  startLocal.setHours(0, 0, 0, 0)
  const endLocal = new Date()
  endLocal.setHours(23, 59, 0, 0)

  const shiftStartTime = toISOZLocal(startLocal)
  const shiftEndTime = toISOZLocal(endLocal)

  const shift = {
    start: { time: shiftStartTime, location: loc(depotLocation) },
    end: { time: shiftEndTime, location: vehicle.returnToDepot !== false ? loc(depotLocation) : undefined },
  }

  const jobs = orders.map((o) => ({
    id: o.id,
    tasks: { deliveries: [makeDeliveryTask(o, SOFT_WINDOWS)] },
  }))

  const jobPlaceById = new Map<string, { lat: number; lng: number }>()
  for (const o of orders) {
    jobPlaceById.set(o.id, { lat: o.latitude, lng: o.longitude })
  }

  const withTimes = jobs.filter((j) => j.tasks?.deliveries?.some((d: any) => d.places?.[0]?.times))
  if (withTimes.length) {
    console.warn(
      `[v0] WARNING: times found on deliveries despite softWindows=true`,
      withTimes.map((j) => j.id),
    )
    for (const j of withTimes) {
      for (const d of j.tasks.deliveries) {
        delete d.places[0].times
      }
    }
  }

  console.log(`[v0] Built problem with ${jobs.length} jobs, shift: ${shiftStartTime} - ${shiftEndTime}`)
  console.log(`[v0] softWindows=${SOFT_WINDOWS}, jobs with times: ${withTimes.length}`)
  if (jobs.length > 0) {
    console.log(`[v0] first job snippet:`, JSON.stringify(jobs[0], null, 2))
  }

  const problem = {
    plan: { jobs },
    fleet: {
      types: [
        {
          id: vehicle.id,
          profile: "car",
          costs: {
            fixed: 10,
            distance: 0.0004,
            time: 0.002,
          },
          shifts: [shift],
          capacity: [vehicle.capacity || env.ROUTE_CAPACITY],
          amount: 1,
        },
      ],
      profiles: [{ name: "car", type: "car" }],
    },
  }

  return { problem, jobPlaceById }
}

/**
 * Builds a multi-vehicle HERE Tour Planning v3 problem
 * @param orders - List of delivery orders
 * @param depot - Shared depot location (optional, will be calculated if not provided)
 * @param vehicles - Array of vehicle configurations
 * @returns Valid HERE Tour Planning v3 problem for multiple vehicles and job place lookup map
 */
export async function buildMultiVehicleProblemV3(
  orders: Order[],
  depot: Depot | null,
  vehicles: VehicleConfig[],
): Promise<BuildProblemResult> {
  let depotChoice
  if (depot && depot.lat && depot.lng) {
    depotChoice = { coords: { lat: depot.lat, lng: depot.lng }, source: "provided" as const }
    console.log(`[v0] Using provided depot: ${depot.lat}, ${depot.lng}`)
  } else {
    depotChoice = await depotFromOrders(orders)
  }

  const depotLocation = loc(depotChoice.coords)

  console.log(`[v0] multi-vehicle depot:`, depotLocation, `(source: ${depotChoice.source})`)
  if (orders.length > 0) {
    const firstJobLoc = { lat: orders[0].latitude, lng: orders[0].longitude }
    const distanceKm = km(depotLocation, firstJobLoc)
    console.log(`[v0] depot->first distance (km):`, distanceKm.toFixed(2))
  }

  const maxStartDistKm = env.MAX_DEPOT_DISTANCE_KM
  const farJobs = orders.filter((o) => {
    const loc = { lat: o.latitude, lng: o.longitude }
    return km(depotLocation, loc) > maxStartDistKm
  })
  if (farJobs.length > 0) {
    console.warn(`[v0] ${farJobs.length} jobs are >${maxStartDistKm}km from depot and may be unassigned`)
  }

  const startLocal = new Date()
  startLocal.setHours(0, 0, 0, 0)
  const endLocal = new Date()
  endLocal.setHours(23, 59, 0, 0)

  const shiftStartTime = toISOZLocal(startLocal)
  const shiftEndTime = toISOZLocal(endLocal)

  const fleetTypes = vehicles.map((v) => {
    // Use vehicle-specific depot if available, otherwise use shared depot
    const vehicleDepot = depotLocation // TODO: Add per-vehicle depot support

    const shift = {
      start: { time: shiftStartTime, location: loc(vehicleDepot) },
      end: { time: shiftEndTime, location: v.returnToDepot !== false ? loc(vehicleDepot) : undefined },
    }

    return {
      id: v.id,
      profile: "car",
      costs: {
        fixed: 10,
        distance: 0.0004,
        time: 0.002,
      },
      shifts: [shift],
      capacity: [v.capacity || env.ROUTE_CAPACITY],
      amount: 1,
    }
  })

  const jobs = orders.map((o) => ({
    id: o.id,
    tasks: { deliveries: [makeDeliveryTask(o, SOFT_WINDOWS)] },
  }))

  const jobPlaceById = new Map<string, { lat: number; lng: number }>()
  for (const o of orders) {
    jobPlaceById.set(o.id, { lat: o.latitude, lng: o.longitude })
  }

  const withTimes = jobs.filter((j) => j.tasks?.deliveries?.some((d: any) => d.places?.[0]?.times))
  if (withTimes.length) {
    console.warn(
      `[v0] WARNING: times found on deliveries despite softWindows=true`,
      withTimes.map((j) => j.id),
    )
    for (const j of withTimes) {
      for (const d of j.tasks.deliveries) {
        delete d.places[0].times
      }
    }
  }

  console.log(`[v0] Built multi-vehicle problem:`)
  console.log(`  - Jobs: ${jobs.length}`)
  console.log(`  - Vehicles: ${vehicles.length}`)
  console.log(`  - Depot: ${depotLocation.lat.toFixed(4)}, ${depotLocation.lng.toFixed(4)} (${depotChoice.source})`)
  console.log(`  - Shift: ${shiftStartTime} to ${shiftEndTime}`)
  console.log(`  - Capacity per vehicle: ${env.ROUTE_CAPACITY}`)
  console.log(`  - Soft windows: ${SOFT_WINDOWS}`)

  if (jobs.length > 0) {
    console.log(`[v0] First job sample:`, JSON.stringify(jobs[0], null, 2))
  }

  const problem = {
    plan: { jobs },
    fleet: {
      types: fleetTypes,
      profiles: [{ name: "car", type: "car" }],
    },
  }

  return { problem, jobPlaceById }
}
