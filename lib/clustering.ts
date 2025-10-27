/**
 * Clusters orders by geographic proximity to prevent unassigned jobs
 * in mixed-city datasets (e.g., Surrey BC + Barrie ON + Toronto)
 */

interface ClusterableOrder {
  id: string
  latitude: number
  longitude: number
  city?: string
  state?: string
}

interface OrderCluster {
  id: string
  orders: ClusterableOrder[]
  centroid: { lat: number; lng: number }
  city?: string
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sa = Math.sin(dLat / 2)
  const sb = Math.sin(dLng / 2)
  return (
    2 *
    R *
    Math.asin(Math.sqrt(sa * sa + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sb * sb))
  )
}

function calculateCentroid(orders: ClusterableOrder[]): { lat: number; lng: number } {
  const sum = orders.reduce((acc, o) => ({ lat: acc.lat + o.latitude, lng: acc.lng + o.longitude }), { lat: 0, lng: 0 })
  return { lat: sum.lat / orders.length, lng: sum.lng / orders.length }
}

/**
 * Cluster orders by city name if available
 */
function clusterByCity(orders: ClusterableOrder[]): OrderCluster[] {
  const cityGroups = new Map<string, ClusterableOrder[]>()

  for (const order of orders) {
    const cityKey = order.city?.toLowerCase().trim() || "unknown"
    if (!cityGroups.has(cityKey)) {
      cityGroups.set(cityKey, [])
    }
    cityGroups.get(cityKey)!.push(order)
  }

  return Array.from(cityGroups.entries()).map(([city, orders], index) => ({
    id: `cluster-${index}`,
    orders,
    centroid: calculateCentroid(orders),
    city,
  }))
}

/**
 * Cluster orders by geographic proximity using simple k-means
 */
function clusterByProximity(orders: ClusterableOrder[], numClusters: number): OrderCluster[] {
  if (orders.length <= numClusters) {
    return orders.map((order, i) => ({
      id: `cluster-${i}`,
      orders: [order],
      centroid: { lat: order.latitude, lng: order.longitude },
    }))
  }

  // Initialize centroids with evenly spaced orders
  const step = Math.floor(orders.length / numClusters)
  let centroids = Array.from({ length: numClusters }, (_, i) => ({
    lat: orders[i * step].latitude,
    lng: orders[i * step].longitude,
  }))

  // Run k-means for max 10 iterations
  for (let iter = 0; iter < 10; iter++) {
    // Assign orders to nearest centroid
    const clusters: ClusterableOrder[][] = Array.from({ length: numClusters }, () => [])

    for (const order of orders) {
      let nearestIdx = 0
      let nearestDist = Number.POSITIVE_INFINITY

      for (let i = 0; i < centroids.length; i++) {
        const dist = haversineKm({ lat: order.latitude, lng: order.longitude }, centroids[i])
        if (dist < nearestDist) {
          nearestDist = dist
          nearestIdx = i
        }
      }

      clusters[nearestIdx].push(order)
    }

    // Recalculate centroids
    const newCentroids = clusters.map((cluster) => (cluster.length > 0 ? calculateCentroid(cluster) : centroids[0]))

    // Check convergence
    const moved = centroids.some((c, i) => haversineKm(c, newCentroids[i]) > 0.1)
    centroids = newCentroids

    if (!moved) break
  }

  // Final assignment
  const finalClusters: ClusterableOrder[][] = Array.from({ length: numClusters }, () => [])
  for (const order of orders) {
    let nearestIdx = 0
    let nearestDist = Number.POSITIVE_INFINITY

    for (let i = 0; i < centroids.length; i++) {
      const dist = haversineKm({ lat: order.latitude, lng: order.longitude }, centroids[i])
      if (dist < nearestDist) {
        nearestDist = dist
        nearestIdx = i
      }
    }

    finalClusters[nearestIdx].push(order)
  }

  return finalClusters
    .filter((cluster) => cluster.length > 0)
    .map((cluster, i) => ({
      id: `cluster-${i}`,
      orders: cluster,
      centroid: calculateCentroid(cluster),
    }))
}

/**
 * Main clustering function - decides strategy based on data
 */
export function clusterOrders(orders: ClusterableOrder[], numDrivers: number, maxClusterRadiusKm = 30): OrderCluster[] {
  if (orders.length === 0) return []
  if (orders.length === 1) {
    return [
      {
        id: "cluster-0",
        orders,
        centroid: { lat: orders[0].latitude, lng: orders[0].longitude },
      },
    ]
  }

  // Strategy 1: If city names are available and diverse, cluster by city
  const uniqueCities = new Set(orders.map((o) => o.city?.toLowerCase().trim()).filter(Boolean))
  if (uniqueCities.size > 1 && uniqueCities.size <= numDrivers * 2) {
    console.log(`[clustering] Using city-based clustering (${uniqueCities.size} cities)`)
    return clusterByCity(orders)
  }

  // Strategy 2: Check if orders are geographically spread
  const centroid = calculateCentroid(orders)
  const maxDistance = Math.max(...orders.map((o) => haversineKm({ lat: o.latitude, lng: o.longitude }, centroid)))

  if (maxDistance > maxClusterRadiusKm) {
    console.log(`[clustering] Orders spread over ${maxDistance.toFixed(1)}km, using proximity clustering`)
    const numClusters = Math.min(Math.ceil(maxDistance / maxClusterRadiusKm), numDrivers)
    return clusterByProximity(orders, numClusters)
  }

  // Strategy 3: All orders are close together, return single cluster
  console.log(`[clustering] All orders within ${maxDistance.toFixed(1)}km, using single cluster`)
  return [
    {
      id: "cluster-0",
      orders,
      centroid,
    },
  ]
}
