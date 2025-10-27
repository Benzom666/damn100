export interface Order {
  id: string
  latitude: number
  longitude: number
  service_seconds?: number | null
  quantity?: number | null
  required_skills?: string[] | null
  tw_start?: string | null
  tw_end?: string | null
}

export interface DriverProfile {
  id: string
  vehicle_capacity?: number | null
  depot_lat?: number | null
  depot_lng?: number | null
  shift_start?: string | null
  shift_end?: string | null
  driver_skills?: string[] | null
}

export interface BuildProblemOptions {
  multiVehicle?: boolean
  returnToDepot?: boolean
  maxStopsPerRoute?: number
}

export function buildProblem(orders: Order[], drivers: DriverProfile[], options: BuildProblemOptions = {}): any {
  const { multiVehicle = false, returnToDepot = true, maxStopsPerRoute = 50 } = options

  // Build jobs from orders
  const jobs = orders.map((order) => {
    const job: any = {
      id: order.id,
      places: [
        {
          location: { lat: order.latitude, lng: order.longitude },
          duration: order.service_seconds || 300, // Default 5 min service time
        },
      ],
    }

    // Add demand if quantity specified
    if (order.quantity) {
      job.demand = [order.quantity]
    }

    // Add time windows if specified
    if (order.tw_start && order.tw_end) {
      job.places[0].times = [
        {
          type: "open",
          start: order.tw_start,
          end: order.tw_end,
        },
      ]
    }

    // Add required skills
    if (order.required_skills && order.required_skills.length > 0) {
      job.skills = { allOf: order.required_skills }
    }

    return job
  })

  // Build vehicles from drivers
  const vehicles = drivers.map((driver) => {
    const vehicle: any = {
      id: driver.id,
      typeId: "delivery-vehicle",
    }

    // Add capacity
    if (driver.vehicle_capacity) {
      vehicle.capacity = [driver.vehicle_capacity]
    }

    // Add depot start location
    if (driver.depot_lat && driver.depot_lng) {
      vehicle.start = {
        location: { lat: driver.depot_lat, lng: driver.depot_lng },
      }

      // Add return to depot if enabled
      if (returnToDepot) {
        vehicle.end = {
          location: { lat: driver.depot_lat, lng: driver.depot_lng },
        }
      }
    }

    // Add shift times
    if (driver.shift_start && driver.shift_end) {
      // Convert HH:MM:SS to ISO timestamp for today
      const today = new Date().toISOString().split("T")[0]
      vehicle.shifts = [
        {
          start: {
            time: `${today}T${driver.shift_start}Z`,
          },
          end: {
            time: `${today}T${driver.shift_end}Z`,
          },
        },
      ]
    }

    // Add driver skills
    if (driver.driver_skills && driver.driver_skills.length > 0) {
      vehicle.skills = driver.driver_skills
    }

    // Add max stops constraint
    vehicle.limits = {
      maxStops: maxStopsPerRoute,
    }

    return vehicle
  })

  // Build vehicle types
  const vehicleTypes = [
    {
      id: "delivery-vehicle",
      profile: "car",
      costs: {
        distance: 0.0001,
        time: 0.0001,
        fixed: 1,
      },
    },
  ]

  const problem = {
    plan: {
      jobs,
      relations: [],
    },
    fleet: {
      vehicles,
      types: vehicleTypes,
    },
  }

  console.log("[v0] Built problem with", jobs.length, "jobs and", vehicles.length, "vehicles")

  return problem
}
