"use client"

import { useEffect, useRef, useState } from "react"
import { getHereApiKey } from "@/app/actions/get-here-api-key"
import { segmentShape } from "@/lib/here/segment-shape"
import { km } from "@/lib/utils/haversine"

const isBrowser = typeof window !== "undefined"

declare global {
  interface Window {
    H: any
  }
}

type LatLng = { lat: number; lng: number; label?: string; color?: string; status?: string; address?: string }

async function loadHereScripts(apiKey: string): Promise<void> {
  if (!isBrowser) return
  if (window.H?.Map) return // Already loaded

  const scripts = [
    "https://js.api.here.com/v3/3.1/mapsjs-core.js",
    "https://js.api.here.com/v3/3.1/mapsjs-service.js",
    "https://js.api.here.com/v3/3.1/mapsjs-ui.js",
    "https://js.api.here.com/v3/3.1/mapsjs-mapevents.js",
  ]

  // Load scripts sequentially
  for (const src of scripts) {
    if (document.querySelector(`script[src="${src}"]`)) continue

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script")
      script.src = src
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Failed to load ${src}`))
      document.head.appendChild(script)
    })
  }

  // Wait for H to be available
  let attempts = 0
  while (!window.H && attempts < 50) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    attempts++
  }

  if (!window.H) {
    throw new Error("HERE Maps SDK failed to initialize")
  }
}

export function HereMap({
  points = [],
  markers = [],
  polylines = [],
  depot,
  focusNextStop = false,
  useRoadPolylines = true,
  height = 420,
  className = "",
}: {
  points?: LatLng[]
  markers?: LatLng[]
  polylines?: LatLng[][]
  depot?: LatLng
  focusNextStop?: boolean
  useRoadPolylines?: boolean
  height?: number
  className?: string
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const allPoints = [...points, ...markers]

  useEffect(() => {
    async function fetchKey() {
      try {
        const key = await getHereApiKey()
        if (!key) {
          setError("HERE API key not configured. Set HERE_API_KEY in environment variables.")
          return
        }
        setApiKey(key)
      } catch (err) {
        console.error("[v0] Error fetching HERE API key:", err)
        setError("Failed to load API key")
      }
    }
    fetchKey()
  }, [])

  useEffect(() => {
    if (!isBrowser) {
      setError("Loading map...")
      return
    }

    let cancelled = false
    let map: any = null
    let behavior: any = null
    let ui: any = null

    async function initMap() {
      try {
        if (!mapRef.current) return

        console.log("[v0] [HERE_MAP] Initializing HERE Map...")

        await loadHereScripts(apiKey)

        if (cancelled) return

        const H = window.H

        const platform = new H.service.Platform({ apikey: apiKey })
        const defaultLayers = platform.createDefaultLayers()

        map = new H.Map(mapRef.current, defaultLayers.vector.normal.map, {
          center: allPoints.length > 0 ? allPoints[0] : { lat: 45.42, lng: -75.69 },
          zoom: 12,
          pixelRatio: window.devicePixelRatio || 1,
        })

        behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map))
        ui = H.ui.UI.createDefault(map, defaultLayers)

        mapInstanceRef.current = map

        const group = new H.map.Group()

        if (depot) {
          const depotSvg = `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="8" width="24" height="24" fill="#10b981" stroke="white" strokeWidth="3" rx="4"/>
            <text x="20" y="26" fontSize="16" fontWeight="bold" textAnchor="middle" fill="white">D</text>
          </svg>`
          const depotIcon = new H.map.Icon(depotSvg)
          const depotMarker = new H.map.Marker(depot, { icon: depotIcon })
          depotMarker.setData({ label: "Depot", lat: depot.lat, lng: depot.lng, isDepot: true })

          depotMarker.addEventListener("tap", (e: any) => {
            const data = e.target.getData()
            const bubble = new H.ui.InfoBubble(e.target.getGeometry(), {
              content: `<div style="padding: 8px;"><strong>🏢 Depot</strong><br/>Lat: ${data.lat.toFixed(5)}<br/>Lng: ${data.lng.toFixed(5)}</div>`,
            })
            ui.addBubble(bubble)
          })

          group.addObject(depotMarker)
        }

        if (allPoints.length > 0) {
          console.log(`[v0] [HERE_MAP] Adding ${allPoints.length} markers to map`)

          allPoints.forEach((point, idx) => {
            if (
              !Number.isFinite(point.lat) ||
              !Number.isFinite(point.lng) ||
              point.lat < -90 ||
              point.lat > 90 ||
              point.lng < -180 ||
              point.lng > 180
            ) {
              console.warn(`[v0] [HERE_MAP] Invalid marker coordinates: lat=${point.lat}, lng=${point.lng}`)
              return
            }

            let icon
            if (point.color) {
              const svgMarkup = `<svg width="36" height="36" xmlns="http://www.w3.org/2000/svg" class="marker">
                <circle cx="18" cy="18" r="16" fill="${point.color}" stroke="white" strokeWidth="3"/>
                <text x="18" y="24" fontSize="16" fontWeight="bold" textAnchor="middle" fill="white">${point.label || idx + 1}</text>
              </svg>`
              icon = new H.map.Icon(svgMarkup)
            }

            const marker = icon ? new H.map.Marker(point, { icon }) : new H.map.Marker(point)
            const label = point.label || `${idx + 1}`
            marker.setData({
              label,
              lat: point.lat,
              lng: point.lng,
              status: point.status,
              address: point.address,
            })

            marker.addEventListener("tap", (e: any) => {
              const data = e.target.getData()
              const statusEmoji = data.status === "delivered" ? "✅" : data.status === "failed" ? "❌" : "📦"
              const content = `
                <div style="padding: 12px; min-width: 200px;">
                  <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">
                    ${statusEmoji} Stop #${data.label}
                  </div>
                  ${data.address ? `<div style="margin-bottom: 4px;">${data.address}</div>` : ""}
                  <div style="font-size: 12px; color: #666; margin-top: 8px;">
                    Lat: ${data.lat.toFixed(5)}<br/>
                    Lng: ${data.lng.toFixed(5)}
                  </div>
                  ${data.status ? `<div style="margin-top: 8px; padding: 4px 8px; background: ${data.status === "delivered" ? "#22c55e" : data.status === "failed" ? "#ef4444" : "#3b82f6"}; color: white; border-radius: 4px; display: inline-block; font-size: 12px;">${data.status}</div>` : ""}
                </div>
              `
              const bubble = new H.ui.InfoBubble(e.target.getGeometry(), { content })
              ui.addBubble(bubble)
            })

            group.addObject(marker)
          })
        }

        if (polylines.length > 0 && useRoadPolylines) {
          console.log(`[v0] [HERE_MAP] Fetching road-snapped polylines for ${polylines.length} route(s)`)

          for (const line of polylines) {
            const lineString = new H.geo.LineString()
            let totalDrift = 0
            let maxDrift = 0

            for (let i = 0; i < line.length - 1; i++) {
              const encodedSegment = await segmentShape(line[i], line[i + 1], apiKey)

              if (encodedSegment) {
                const segmentLine = H.geo.LineString.fromFlexiblePolyline(encodedSegment)
                const points = segmentLine.getLatLngAltArray()

                if (points.length >= 3) {
                  const firstPolyPoint = { lat: points[0], lng: points[1] }
                  const drift = km(line[i], firstPolyPoint)
                  totalDrift += drift
                  maxDrift = Math.max(maxDrift, drift)

                  if (drift > 0.05) {
                    console.warn(
                      `[v0] [HERE_MAP] Marker drift >${(drift * 1000) | 0}m at stop ${i + 1}:`,
                      `job=(${line[i].lat.toFixed(5)},${line[i].lng.toFixed(5)})`,
                      `poly=(${firstPolyPoint.lat.toFixed(5)},${firstPolyPoint.lng.toFixed(5)})`,
                    )
                  }
                }

                for (let j = i === 0 ? 0 : 3; j < points.length; j += 3) {
                  const lat = points[j]
                  const lng = points[j + 1]

                  if (
                    Number.isFinite(lat) &&
                    Number.isFinite(lng) &&
                    lat >= -90 &&
                    lat <= 90 &&
                    lng >= -180 &&
                    lng <= 180
                  ) {
                    lineString.pushLatLngAlt(lat, lng, 0)
                  } else {
                    console.warn(`[v0] [HERE_MAP] Invalid polyline coordinate: lat=${lat}, lng=${lng}`)
                  }
                }
              } else {
                if (i === 0) {
                  lineString.pushLatLngAlt(line[i].lat, line[i].lng, 0)
                }
                lineString.pushLatLngAlt(line[i + 1].lat, line[i + 1].lng, 0)
              }
            }

            const pointCount = lineString.getLatLngAltArray().length / 3
            console.log(
              `[v0] [HERE_MAP] Road polyline: ${pointCount} points, avg drift: ${((totalDrift / line.length) * 1000) | 0}m, max drift: ${(maxDrift * 1000) | 0}m`,
            )

            const polyline = new H.map.Polyline(lineString, {
              style: {
                strokeColor: "#3b82f6",
                lineWidth: 5,
                lineCap: "round",
                lineJoin: "round",
              },
            })
            group.addObject(polyline)
          }
        } else if (polylines.length > 0) {
          console.log(`[v0] [HERE_MAP] Drawing ${polylines.length} straight polyline(s)`)
          polylines.forEach((line) => {
            const lineString = new H.geo.LineString()
            line.forEach((p) => {
              if (
                Number.isFinite(p.lat) &&
                Number.isFinite(p.lng) &&
                p.lat >= -90 &&
                p.lat <= 90 &&
                p.lng >= -180 &&
                p.lng <= 180
              ) {
                lineString.pushLatLngAlt(p.lat, p.lng, 0)
              }
            })
            const polyline = new H.map.Polyline(lineString, {
              style: {
                strokeColor: "#3b82f6",
                lineWidth: 5,
                lineCap: "round",
                lineJoin: "round",
              },
            })
            group.addObject(polyline)
          })
        }

        map.addObject(group)

        if (group.getBoundingBox()) {
          map.getViewModel().setLookAtData({
            bounds: group.getBoundingBox(),
            padding: { top: 64, right: 64, bottom: 64, left: 64 },
          })
        }

        if (focusNextStop && allPoints.length > 0) {
          const nextStop = allPoints.find((p) => p.status !== "delivered" && p.status !== "failed")
          if (nextStop) {
            console.log(`[v0] [HERE_MAP] Focusing on next stop: ${nextStop.label}`)
            setTimeout(() => {
              map.getViewModel().setLookAtData({ position: nextStop, zoom: 16 }, true)
            }, 1000)
          }
        }

        const onResize = () => map.getViewPort().resize()
        window.addEventListener("resize", onResize)

        console.log("[v0] [HERE_MAP] ✓ Map initialized successfully")

        return () => {
          window.removeEventListener("resize", onResize)
          if (ui) ui.dispose()
          if (behavior) behavior.dispose()
          if (map) map.dispose()
        }
      } catch (err) {
        console.error("[v0] [HERE_MAP] ✗ Map error:", err)
        setError(err instanceof Error ? err.message : "Failed to load map")
      }
    }

    initMap()

    return () => {
      cancelled = true
      if (ui) ui.dispose()
      if (behavior) behavior.dispose()
      if (map) map.dispose()
    }
  }, [
    apiKey,
    JSON.stringify(allPoints),
    JSON.stringify(polylines),
    JSON.stringify(depot),
    focusNextStop,
    useRoadPolylines,
  ])

  if (error) {
    return (
      <div
        style={{ height: `${height}px` }}
        className={`w-full rounded border bg-red-50 flex items-center justify-center text-red-600 p-4 ${className}`}
      >
        <div className="text-center">
          <p className="font-semibold mb-2">Map Error</p>
          <p className="text-sm">{error}</p>
          {error.includes("API key") && (
            <p className="text-xs mt-2 text-muted-foreground">
              Set <code className="bg-red-100 px-1 rounded">HERE_API_KEY</code> in Vercel environment variables
            </p>
          )}
        </div>
      </div>
    )
  }

  if (!apiKey) {
    return (
      <div
        style={{ height: `${height}px` }}
        className={`w-full rounded border bg-muted flex items-center justify-center text-muted-foreground ${className}`}
      >
        Loading map...
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      style={{ height: `${height}px` }}
      className={`here-map-container w-full rounded border ${className}`}
    />
  )
}

export default HereMap
