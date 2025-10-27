"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useState, useEffect } from "react"
import { CheckCircle, XCircle, Clock, Package, User, MapIcon, MapPin } from "lucide-react"
import { HereMap } from "@/components/here-map"

interface DispatchMonitorProps {
  routes: any[]
  orders: any[]
  pods: any[]
  driverPositions: any[]
}

export function DispatchMonitor({
  routes,
  orders,
  pods,
  driverPositions: initialDriverPositions,
}: DispatchMonitorProps) {
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [isPODDialogOpen, setIsPODDialogOpen] = useState(false)
  const [showMap, setShowMap] = useState(true)
  const [driverPositions, setDriverPositions] = useState(initialDriverPositions)

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_DISPATCH_MAP !== "true") return

    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/driver-positions")
        if (response.ok) {
          const data = await response.json()
          setDriverPositions(data.positions || [])
        }
      } catch (error) {
        console.error("[v0] Error refreshing driver positions:", error)
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [])

  function getRouteOrders(routeId: string) {
    return orders.filter((o) => o.route_id === routeId)
  }

  function getOrderPOD(orderId: string) {
    return pods.find((p) => p.order_id === orderId)
  }

  function handleViewPOD(order: any) {
    setSelectedOrder(order)
    setIsPODDialogOpen(true)
  }

  const selectedPOD = selectedOrder ? getOrderPOD(selectedOrder.id) : null

  const allMarkers = orders
    .filter((o) => o.latitude && o.longitude)
    .map((o) => ({
      lat: o.latitude,
      lng: o.longitude,
      label: o.stop_sequence?.toString() || "?",
      color: o.status === "delivered" ? "#22c55e" : o.status === "failed" ? "#ef4444" : "#3b82f6",
      status: o.status,
      address: o.address,
      customerId: o.customer_name,
      orderId: o.id,
    }))

  const driverMarkers = driverPositions.map((dp) => ({
    lat: dp.lat,
    lng: dp.lng,
    label: "🚗",
    color: "#8b5cf6",
    status: "driver",
    address: dp.profiles?.display_name || dp.profiles?.email || "Driver",
    customerId: "",
    orderId: dp.driver_id,
  }))

  const allMarkersWithDrivers = [...allMarkers, ...driverMarkers]

  const routePolylines = routes
    .map((route) => {
      const routeOrders = getRouteOrders(route.id)
        .filter((o) => o.latitude && o.longitude && o.stop_sequence != null)
        .sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0))

      if (routeOrders.length < 2) return null

      return routeOrders.map((o) => ({
        lat: o.latitude,
        lng: o.longitude,
      }))
    })
    .filter(Boolean) as Array<Array<{ lat: number; lng: number }>>

  const enableDispatchMap = process.env.NEXT_PUBLIC_ENABLE_DISPATCH_MAP === "true"

  function getTimeSinceUpdate(updatedAt: string) {
    const now = new Date()
    const updated = new Date(updatedAt)
    const diffMs = now.getTime() - updated.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "just now"
    if (diffMins === 1) return "1 min ago"
    if (diffMins < 60) return `${diffMins} mins ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours === 1) return "1 hour ago"
    return `${diffHours} hours ago`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dispatch Monitor</h2>
          <p className="text-muted-foreground">Real-time tracking of active routes and deliveries</p>
        </div>
        {allMarkersWithDrivers.length > 0 && enableDispatchMap && (
          <Button variant="outline" onClick={() => setShowMap(!showMap)}>
            <MapIcon className="mr-2 h-4 w-4" />
            {showMap ? "Hide Map" : "Show Map"}
          </Button>
        )}
      </div>

      {showMap && allMarkersWithDrivers.length > 0 && enableDispatchMap && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Live Dispatch Map</h3>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Delivered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">Failed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-muted-foreground">Driver</span>
                </div>
              </div>
            </div>
            <HereMap
              markers={allMarkersWithDrivers}
              polylines={routePolylines}
              useRoadPolylines={true}
              className="h-[500px]"
            />

            {driverPositions.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Driver Locations
                </h4>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {driverPositions.map((dp) => (
                    <div
                      key={dp.driver_id}
                      className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className="font-medium">
                          {dp.profiles?.display_name || dp.profiles?.email || "Driver"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{getTimeSinceUpdate(dp.updated_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{routes.length}</p>
              <p className="text-sm text-muted-foreground">Active Routes</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{orders.filter((o) => o.status === "assigned").length}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{orders.filter((o) => o.status === "delivered").length}</p>
              <p className="text-sm text-muted-foreground">Delivered</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{orders.filter((o) => o.status === "failed").length}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Routes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Active Routes</h3>
        {routes.length === 0 ? (
          <Card className="p-6 text-center">
            <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No active routes at the moment</p>
          </Card>
        ) : (
          routes.map((route) => {
            const routeOrders = getRouteOrders(route.id)
            const pending = routeOrders.filter((o) => o.status === "assigned").length
            const delivered = routeOrders.filter((o) => o.status === "delivered").length
            const failed = routeOrders.filter((o) => o.status === "failed").length
            const total = routeOrders.length
            const progress = total > 0 ? Math.round(((delivered + failed) / total) * 100) : 0

            return (
              <Card key={route.id} className="p-6">
                <div className="space-y-4">
                  {/* Route Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xl font-semibold">{route.name}</h4>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>
                          {route.profiles ? route.profiles.display_name || route.profiles.email : "Unassigned"}
                        </span>
                      </div>
                    </div>
                    <Badge variant={route.status === "active" ? "default" : "secondary"}>{route.status}</Badge>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {delivered + failed} / {total} stops
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-center">
                      <Clock className="h-4 w-4 mx-auto mb-1 text-blue-600" />
                      <div className="text-lg font-bold text-blue-700 dark:text-blue-400">{pending}</div>
                      <div className="text-xs text-blue-600 dark:text-blue-500">Pending</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-center">
                      <CheckCircle className="h-4 w-4 mx-auto mb-1 text-green-600" />
                      <div className="text-lg font-bold text-green-700 dark:text-green-400">{delivered}</div>
                      <div className="text-xs text-green-600 dark:text-green-500">Delivered</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3 text-center">
                      <XCircle className="h-4 w-4 mx-auto mb-1 text-red-600" />
                      <div className="text-lg font-bold text-red-700 dark:text-red-400">{failed}</div>
                      <div className="text-xs text-red-600 dark:text-red-500">Failed</div>
                    </div>
                  </div>

                  {/* Orders List */}
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold">Stops</h5>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {routeOrders.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                              {order.stop_sequence}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{order.customer_name}</p>
                              <p className="text-sm text-muted-foreground truncate">{order.address}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {order.status === "delivered" && (
                              <>
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <Button variant="ghost" size="sm" onClick={() => handleViewPOD(order)}>
                                  View POD
                                </Button>
                              </>
                            )}
                            {order.status === "failed" && <XCircle className="h-5 w-5 text-red-600" />}
                            {order.status === "assigned" && <Clock className="h-5 w-5 text-muted-foreground" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* POD Dialog */}
      <Dialog open={isPODDialogOpen} onOpenChange={setIsPODDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Proof of Delivery</DialogTitle>
            <DialogDescription>
              {selectedOrder?.customer_name} - {selectedOrder?.address}
            </DialogDescription>
          </DialogHeader>

          {selectedPOD ? (
            <div className="space-y-4">
              {selectedPOD.photo_url && (
                <div>
                  <p className="text-sm font-medium mb-2">Photo</p>
                  <img
                    src={selectedPOD.photo_url || "/placeholder.svg"}
                    alt="Delivery proof"
                    className="w-full rounded-lg border"
                  />
                </div>
              )}
              {selectedPOD.signature_url && (
                <div>
                  <p className="text-sm font-medium mb-2">Signature</p>
                  <img
                    src={selectedPOD.signature_url || "/placeholder.svg"}
                    alt="Signature"
                    className="w-full rounded-lg border bg-white"
                  />
                </div>
              )}
              {selectedPOD.recipient_name && (
                <div>
                  <p className="text-sm font-medium mb-1">Received By</p>
                  <p className="text-base">{selectedPOD.recipient_name}</p>
                </div>
              )}
              {selectedPOD.notes && (
                <div>
                  <p className="text-sm font-medium mb-1">Notes</p>
                  <p className="text-base">{selectedPOD.notes}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium mb-1">Captured At</p>
                <p className="text-base">{new Date(selectedPOD.captured_at).toLocaleString()}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No proof of delivery available</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
