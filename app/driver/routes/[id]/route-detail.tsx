"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, CheckCircle, XCircle, Clock, Navigation } from "lucide-react"
import Link from "next/link"
import { HereMap } from "@/components/here-map"
import { useState, useEffect } from "react"
import { updateDriverPosition } from "@/app/driver/actions"

interface RouteDetailProps {
  route: any
  orders: any[]
}

export function RouteDetail({ route, orders }: RouteDetailProps) {
  const [showMap, setShowMap] = useState(true)
  const completedCount = orders.filter((o) => o.status === "delivered").length
  const failedCount = orders.filter((o) => o.status === "failed").length
  const pendingCount = orders.filter((o) => o.status === "assigned" || o.status === "in_transit").length

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("[v0] Geolocation not supported")
      return
    }

    let watchId: number

    const updatePosition = async (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords
      console.log("[v0] Driver position updated:", latitude, longitude)

      const result = await updateDriverPosition(latitude, longitude, accuracy)
      if (!result.success) {
        console.error("[v0] Failed to update driver position:", result.error)
      }
    }

    const handleError = (error: GeolocationPositionError) => {
      console.error("[v0] Geolocation error:", error.message)
    }

    // Update position every 30 seconds
    watchId = navigator.geolocation.watchPosition(updatePosition, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    })

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [])

  const markers = orders
    .filter((o) => o.latitude && o.longitude)
    .map((o) => ({
      lat: o.latitude,
      lng: o.longitude,
      label: o.stop_sequence?.toString() || "?",
      color: o.status === "delivered" ? "#22c55e" : o.status === "failed" ? "#ef4444" : "#3b82f6",
    }))

  const buildNavigationUrl = (lat: number, lng: number) => {
    // Destination-only link (no origin)
    return `https://www.here.com/directions/drive/${lat},${lng}`
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/driver">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{route.name}</h1>
              <p className="text-sm opacity-90">
                {completedCount + failedCount} of {orders.length} stops complete
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-primary-foreground/10 rounded-lg p-2 text-center">
              <div className="text-2xl font-bold">{pendingCount}</div>
              <div className="text-xs opacity-90">Pending</div>
            </div>
            <div className="bg-primary-foreground/10 rounded-lg p-2 text-center">
              <div className="text-2xl font-bold">{completedCount}</div>
              <div className="text-xs opacity-90">Delivered</div>
            </div>
            <div className="bg-primary-foreground/10 rounded-lg p-2 text-center">
              <div className="text-2xl font-bold">{failedCount}</div>
              <div className="text-xs opacity-90">Failed</div>
            </div>
          </div>
        </div>
      </div>

      {showMap && markers.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 pt-4 min-h-[420px]">
          <HereMap markers={markers} className="h-96 rounded-lg border" showToggle />
        </div>
      )}

      {/* Stops List */}
      <div className="max-w-2xl mx-auto p-4 space-y-3 pb-20">
        {orders.map((order) => (
          <Link key={order.id} href={`/driver/routes/${route.id}/${order.id}`}>
            <Card className="p-4 hover:bg-accent transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  {order.stop_sequence}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold truncate">{order.customer_name}</h3>
                    <div className="flex items-center gap-2">
                      {order.latitude && order.longitude && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:text-primary/80 hover:bg-transparent"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            window.open(
                              buildNavigationUrl(order.latitude, order.longitude),
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }}
                        >
                          <Navigation className="h-4 w-4" />
                        </Button>
                      )}
                      {order.status === "delivered" && <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />}
                      {order.status === "failed" && <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />}
                      {(order.status === "assigned" || order.status === "in_transit") && (
                        <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{order.address}</p>
                  {order.phone && <p className="text-sm text-primary">{order.phone}</p>}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
