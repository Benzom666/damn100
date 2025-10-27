"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import dynamic from "next/dynamic"
import { ArrowLeft, User, Package, MapPin, Edit, Trash2, Calculator, Ruler, Clock } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateRoute, deleteRoute, recalcRouteMetricsAction } from "../actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import ErrorBoundary from "@/components/error-boundary"
import { formatDuration } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const HereMapClient = dynamic(() => import("@/components/here-map"), {
  ssr: false,
  loading: () => (
    <div className="h-96 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground">
      Loading map...
    </div>
  ),
})

interface RouteDetailViewProps {
  route: any
  orders: any[]
  drivers?: any[]
}

export function RouteDetailView({ route, orders, drivers = [] }: RouteDetailViewProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editName, setEditName] = useState(route.name)
  const [editDriverId, setEditDriverId] = useState(route.driver_id || "unassigned")
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const router = useRouter()

  const orderedStops = orders
    .filter((o) => o.latitude && o.longitude && o.stop_sequence != null)
    .sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0))

  const markers = orderedStops.map((o) => ({
    lat: o.latitude,
    lng: o.longitude,
    label: o.stop_sequence?.toString() || "?",
    color: o.status === "delivered" ? "#22c55e" : o.status === "failed" ? "#ef4444" : "#3b82f6",
    status: o.status,
    address: o.address,
    customerId: o.customer_name,
    orderId: o.id,
  }))

  const completedCount = orders.filter((o) => o.status === "delivered").length
  const failedCount = orders.filter((o) => o.status === "failed").length

  const hasUnservedStops = orders.some((o) => o.status !== "delivered" && o.status !== "failed")

  const enableMetrics = process.env.NEXT_PUBLIC_ENABLE_ROUTE_METRICS !== "false"
  const serviceTimePerStopSec = Number(process.env.NEXT_PUBLIC_SERVICE_TIME_PER_STOP_SEC) || 90

  const remainingStops = route.total_stops - completedCount
  const remainingDriveTimeSec = route.drive_time_sec
    ? Math.round(route.drive_time_sec * (remainingStops / route.total_stops))
    : 0
  const remainingServiceTimeSec = remainingStops * serviceTimePerStopSec
  const remainingTotalSec = remainingDriveTimeSec + remainingServiceTimeSec

  // Check if metrics are stale (older than 4 hours)
  const metricsStale = route.metrics_updated_at
    ? Date.now() - new Date(route.metrics_updated_at).getTime() > 4 * 60 * 60 * 1000
    : false

  // Check if any stops are missing coordinates
  const missingCoords = orders.filter((o) => !o.latitude || !o.longitude).length

  function getStatusColor(status: string) {
    switch (status) {
      case "draft":
        return "secondary"
      case "active":
        return "default"
      case "completed":
        return "default"
      default:
        return "secondary"
    }
  }

  const polylines = orderedStops.length > 1 ? [orderedStops.map((o) => ({ lat: o.latitude, lng: o.longitude }))] : []

  const depot =
    route.depot_lat && route.depot_lng ? { lat: route.depot_lat, lng: route.depot_lng, label: "Depot" } : undefined

  async function handleUpdateRoute() {
    setIsUpdating(true)
    try {
      await updateRoute(route.id, {
        name: editName,
        driver_id: editDriverId || null,
      })
      toast.success("Route updated successfully")
      setIsEditDialogOpen(false)
      router.refresh()
    } catch (error) {
      console.error("[v0] Error updating route:", error)
      toast.error("Failed to update route")
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleDeleteRoute() {
    if (!confirm("Are you sure you want to delete this route? All orders will be reset to pending.")) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteRoute(route.id)
      toast.success("Route deleted successfully")
      router.push("/admin/routes")
    } catch (error) {
      console.error("[v0] Error deleting route:", error)
      toast.error("Failed to delete route")
      setIsDeleting(false)
    }
  }

  async function handleRecalcMetrics() {
    setIsRecalculating(true)
    try {
      const metrics = await recalcRouteMetricsAction(route.id)
      toast.success(`Metrics updated: ${metrics.distance_km.toFixed(1)} km, ${formatDuration(metrics.duration_sec)}`)
      router.refresh()
    } catch (error) {
      console.error("[v0] Error recalculating metrics:", error)
      toast.error("Failed to recalculate metrics")
    } finally {
      setIsRecalculating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/routes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{route.name}</h1>
          <p className="text-muted-foreground">Route details and stop visualization</p>
        </div>
        <Badge variant={getStatusColor(route.status)}>{route.status}</Badge>
        {enableMetrics && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalcMetrics}
            disabled={isRecalculating || missingCoords > 0}
          >
            <Calculator className="h-4 w-4 mr-2" />
            {isRecalculating ? "Calculating..." : "Recalculate Metrics"}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteRoute} disabled={isDeleting}>
          <Trash2 className="h-4 w-4 mr-2" />
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Driver</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {route.profiles ? route.profiles.display_name || route.profiles.email : "Unassigned"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stops</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{route.total_stops}</div>
            <p className="text-xs text-muted-foreground">
              {completedCount} delivered, {failedCount} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round((route.completed_stops / route.total_stops) * 100)}%</div>
            <p className="text-xs text-muted-foreground">
              {route.completed_stops} of {route.total_stops} complete
            </p>
          </CardContent>
        </Card>

        {enableMetrics && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Distance</CardTitle>
              <Ruler className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {missingCoords > 0 ? (
                <div className="text-sm text-amber-600">
                  <p className="font-semibold">Needs geocoding</p>
                  <p className="text-xs">{missingCoords} stops missing coordinates</p>
                </div>
              ) : route.distance_km ? (
                <>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    {route.distance_km.toFixed(1)} km
                    {metricsStale && (
                      <Badge variant="outline" className="text-xs">
                        stale
                      </Badge>
                    )}
                  </div>
                  {route.metrics_updated_at && (
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(route.metrics_updated_at).toLocaleString()}
                    </p>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p>Not calculated</p>
                  <p className="text-xs">Click Recalculate Metrics</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {enableMetrics && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {missingCoords > 0 ? (
                <div className="text-sm text-amber-600">
                  <p className="font-semibold">Needs geocoding</p>
                  <p className="text-xs">{missingCoords} stops missing coordinates</p>
                </div>
              ) : route.duration_sec ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <div className="text-2xl font-bold flex items-center gap-2">
                          {formatDuration(route.duration_sec)}
                          {metricsStale && (
                            <Badge variant="outline" className="text-xs">
                              stale
                            </Badge>
                          )}
                        </div>
                        {remainingStops > 0 && (
                          <p className="text-xs text-muted-foreground">
                            ~{formatDuration(remainingTotalSec)} remaining ({remainingStops} stops)
                          </p>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs space-y-1">
                        <p>
                          <strong>Drive time:</strong> {formatDuration(route.drive_time_sec)}
                        </p>
                        <p>
                          <strong>Service time:</strong> {formatDuration(route.service_time_sec)}
                        </p>
                        <p>
                          <strong>Total:</strong> {formatDuration(route.duration_sec)}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p>Not calculated</p>
                  <p className="text-xs">Click Recalculate Metrics</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {markers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Route Map</CardTitle>
          </CardHeader>
          <CardContent>
            <ErrorBoundary
              fallback={
                <div className="h-96 rounded-lg border bg-red-50 flex items-center justify-center text-red-600 p-4">
                  <div className="text-center">
                    <p className="font-semibold mb-2">Map failed to load</p>
                    <p className="text-sm">Please refresh the page or check your network connection</p>
                  </div>
                </div>
              }
            >
              <HereMapClient
                markers={markers}
                polylines={polylines}
                depot={depot}
                focusNextStop={hasUnservedStops}
                useRoadPolylines={true}
                height={384}
                className="rounded-lg"
              />
            </ErrorBoundary>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Stops ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  {order.stop_sequence}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold">{order.customer_name}</h3>
                    <Badge
                      variant={
                        order.status === "delivered"
                          ? "default"
                          : order.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {order.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{order.address}</p>
                  {order.city && (
                    <p className="text-sm text-muted-foreground">
                      {order.city}
                      {order.state && `, ${order.state}`} {order.zip}
                    </p>
                  )}
                  {order.phone && <p className="text-sm text-primary mt-1">{order.phone}</p>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Route</DialogTitle>
            <DialogDescription>Update route name and assigned driver</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="route-name">Route Name</Label>
              <Input
                id="route-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter route name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver">Assigned Driver</Label>
              <Select value={editDriverId} onValueChange={setEditDriverId}>
                <SelectTrigger id="driver">
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.display_name || driver.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRoute} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Update Route"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
