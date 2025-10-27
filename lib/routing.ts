// Routing optimization utilities

interface Coordinates {
  latitude: number
  longitude: number
}

interface Stop {
  id: string
  latitude: number
  longitude: number
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180
  const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.latitude * Math.PI) / 180) *
      Math.cos((coord2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Nearest neighbor algorithm for route optimization
export function optimizeRouteNearestNeighbor(stops: Stop[], startPoint?: Coordinates): string[] {
  if (stops.length === 0) return []
  if (stops.length === 1) return [stops[0].id]

  const unvisited = [...stops]
  const route: string[] = []

  // Start from the provided start point or the first stop
  let current: Coordinates = startPoint || { latitude: stops[0].latitude, longitude: stops[0].longitude }

  while (unvisited.length > 0) {
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY

    // Find the nearest unvisited stop
    unvisited.forEach((stop, index) => {
      const distance = calculateDistance(current, { latitude: stop.latitude, longitude: stop.longitude })
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    const nearest = unvisited[nearestIndex]
    route.push(nearest.id)
    current = { latitude: nearest.latitude, longitude: nearest.longitude }
    unvisited.splice(nearestIndex, 1)
  }

  return route
}

// 2-opt optimization to improve route
export function optimize2Opt(stops: Stop[], initialRoute: string[]): string[] {
  if (stops.length < 4) return initialRoute

  const stopMap = new Map(stops.map((s) => [s.id, s]))
  let route = [...initialRoute]
  let improved = true

  function calculateRouteDistance(r: string[]): number {
    let total = 0
    for (let i = 0; i < r.length - 1; i++) {
      const stop1 = stopMap.get(r[i])!
      const stop2 = stopMap.get(r[i + 1])!
      total += calculateDistance(
        { latitude: stop1.latitude, longitude: stop1.longitude },
        { latitude: stop2.latitude, longitude: stop2.longitude },
      )
    }
    return total
  }

  let currentDistance = calculateRouteDistance(route)

  // Try to improve the route by swapping edges
  while (improved) {
    improved = false
    for (let i = 1; i < route.length - 2; i++) {
      for (let j = i + 1; j < route.length - 1; j++) {
        // Reverse the segment between i and j
        const newRoute = [...route.slice(0, i), ...route.slice(i, j + 1).reverse(), ...route.slice(j + 1)]
        const newDistance = calculateRouteDistance(newRoute)

        if (newDistance < currentDistance) {
          route = newRoute
          currentDistance = newDistance
          improved = true
        }
      }
    }
  }

  return route
}

// Calculate total route distance
export function calculateTotalDistance(stops: Stop[], route: string[]): number {
  if (route.length < 2) return 0

  const stopMap = new Map(stops.map((s) => [s.id, s]))
  let total = 0

  for (let i = 0; i < route.length - 1; i++) {
    const stop1 = stopMap.get(route[i])!
    const stop2 = stopMap.get(route[i + 1])!
    total += calculateDistance(
      { latitude: stop1.latitude, longitude: stop1.longitude },
      { latitude: stop2.latitude, longitude: stop2.longitude },
    )
  }

  return total
}
