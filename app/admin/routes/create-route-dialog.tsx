"use client"

import { Button } from "@/components/ui/button"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createRoute, createMultipleRoutes } from "./actions"
import { useState } from "react"
import type { Order, Profile } from "@/lib/types"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface CreateRouteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orders: Order[]
  drivers: Profile[]
}

export interface OptimizationConfig {
  useWarehouse: boolean
  warehouseLocation: string
  returnToWarehouse: boolean
  maxOrders: number | null
  vehicleCapacity: number | null
  timeStart: string
  timeEnd: string
}

export function CreateRouteDialog({ open, onOpenChange, orders, drivers }: CreateRouteDialogProps) {
  const [name, setName] = useState("")
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [driverId, setDriverId] = useState<string | null>(null)
  const [multiDriverMode, setMultiDriverMode] = useState(false)
  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set())
  const [use2Opt, setUse2Opt] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const [useWarehouse, setUseWarehouse] = useState(false)
  const [warehouseLocation, setWarehouseLocation] = useState("")
  const [returnToWarehouse, setReturnToWarehouse] = useState(true)
  const [maxOrders, setMaxOrders] = useState("")
  const [vehicleCapacity, setVehicleCapacity] = useState("")
  const [timeStart, setTimeStart] = useState("09:00")
  const [timeEnd, setTimeEnd] = useState("17:00")

  const availableOrders = orders.filter((o) => o.status === "pending" && o.latitude && o.longitude)

  function toggleOrder(orderId: string) {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
    } else {
      newSelected.add(orderId)
    }
    setSelectedOrders(newSelected)
  }

  function toggleDriver(driverId: string) {
    const newSelected = new Set(selectedDrivers)
    if (newSelected.has(driverId)) {
      newSelected.delete(driverId)
    } else {
      newSelected.add(driverId)
    }
    setSelectedDrivers(newSelected)
  }

  function toggleAllOrders() {
    if (selectedOrders.size === availableOrders.length) {
      // If all are selected, deselect all
      setSelectedOrders(new Set())
    } else {
      // Otherwise, select all
      setSelectedOrders(new Set(availableOrders.map((o) => o.id)))
    }
  }

  async function handleCreate() {
    if (selectedOrders.size === 0) return

    setIsLoading(true)
    try {
      const optimizationConfig: OptimizationConfig = {
        useWarehouse,
        warehouseLocation,
        returnToWarehouse,
        maxOrders: maxOrders ? Number.parseInt(maxOrders) : null,
        vehicleCapacity: vehicleCapacity ? Number.parseInt(vehicleCapacity) : null,
        timeStart,
        timeEnd,
      }

      if (multiDriverMode && selectedDrivers.size > 1) {
        await createMultipleRoutes(Array.from(selectedOrders), Array.from(selectedDrivers), use2Opt, optimizationConfig)
      } else {
        if (!name) {
          alert("Please enter a route name")
          setIsLoading(false)
          return
        }
        await createRoute(name, Array.from(selectedOrders), driverId, use2Opt, optimizationConfig)
      }

      setName("")
      setSelectedOrders(new Set())
      setDriverId(null)
      setSelectedDrivers(new Set())
      setMultiDriverMode(false)
      setUse2Opt(false)
      setUseWarehouse(false)
      setWarehouseLocation("")
      setReturnToWarehouse(true)
      setMaxOrders("")
      setVehicleCapacity("")
      setTimeStart("09:00")
      setTimeEnd("17:00")
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      console.error("Error creating route:", error)
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Route</DialogTitle>
          <DialogDescription>
            {multiDriverMode
              ? "Select multiple drivers for multi-vehicle optimization"
              : "Select orders and configure route optimization"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="multi-driver"
              checked={multiDriverMode}
              onCheckedChange={(checked) => {
                setMultiDriverMode(checked === true)
                if (checked) {
                  setDriverId(null)
                  setName("")
                } else {
                  setSelectedDrivers(new Set())
                }
              }}
            />
            <Label htmlFor="multi-driver" className="text-sm font-normal">
              Multi-vehicle optimization (distribute orders across multiple drivers)
            </Label>
          </div>

          {!multiDriverMode && (
            <div className="grid gap-2">
              <Label htmlFor="route-name">Route Name</Label>
              <Input
                id="route-name"
                placeholder="Morning Route - Downtown"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          {multiDriverMode ? (
            <div className="space-y-2">
              <Label>Select Drivers ({selectedDrivers.size} selected)</Label>
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {drivers.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No drivers available</div>
                ) : (
                  <div className="divide-y">
                    {drivers.map((driver) => (
                      <div key={driver.id} className="flex items-center space-x-3 p-3 hover:bg-accent">
                        <Checkbox
                          checked={selectedDrivers.has(driver.id)}
                          onCheckedChange={() => toggleDriver(driver.id)}
                        />
                        <div className="flex-1 text-sm">
                          <div className="font-medium">{driver.display_name || driver.email}</div>
                          {driver.vehicle_capacity && (
                            <div className="text-xs text-muted-foreground">Capacity: {driver.vehicle_capacity}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedDrivers.size > 1 && (
                <Badge variant="secondary" className="mt-2">
                  HERE Tour Planning will optimize {selectedOrders.size} orders across {selectedDrivers.size} vehicles
                </Badge>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="driver">Assign Driver (Optional)</Label>
              <Select
                value={driverId || "unassigned"}
                onValueChange={(val) => setDriverId(val === "unassigned" ? null : val)}
              >
                <SelectTrigger id="driver">
                  <SelectValue placeholder="Select driver..." />
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
          )}

          <div className="flex items-center space-x-2">
            <Checkbox id="use-2opt" checked={use2Opt} onCheckedChange={(checked) => setUse2Opt(checked === true)} />
            <Label htmlFor="use-2opt" className="text-sm font-normal">
              Use 2-opt optimization fallback (if HERE fails)
            </Label>
          </div>

          <Separator className="my-4" />
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-3">Optimization Configuration</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Configure depot location, vehicle constraints, and time windows for route optimization
              </p>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-warehouse"
                  checked={useWarehouse}
                  onCheckedChange={(checked) => setUseWarehouse(checked === true)}
                />
                <Label htmlFor="use-warehouse" className="text-sm font-normal">
                  Start from warehouse/depot
                </Label>
              </div>

              {useWarehouse && (
                <div className="ml-6 space-y-2">
                  <Label htmlFor="warehouse-location" className="text-xs">
                    Warehouse Location
                  </Label>
                  <Input
                    id="warehouse-location"
                    placeholder="Enter address or lat,lng (e.g., 45.4215,-75.6972)"
                    value={warehouseLocation}
                    onChange={(e) => setWarehouseLocation(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use driver's default depot or system default (Ottawa)
                  </p>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="return-to-warehouse"
                  checked={returnToWarehouse}
                  onCheckedChange={(checked) => setReturnToWarehouse(checked === true)}
                />
                <Label htmlFor="return-to-warehouse" className="text-sm font-normal">
                  Return to warehouse/depot at end
                </Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-orders" className="text-xs">
                    Max Orders per Route
                  </Label>
                  <Input
                    id="max-orders"
                    type="number"
                    placeholder="e.g., 25"
                    value={maxOrders}
                    onChange={(e) => setMaxOrders(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle-capacity" className="text-xs">
                    Vehicle Capacity
                  </Label>
                  <Input
                    id="vehicle-capacity"
                    type="number"
                    placeholder="e.g., 50"
                    value={vehicleCapacity}
                    onChange={(e) => setVehicleCapacity(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Shift Time Window</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="time-start" className="text-xs text-muted-foreground">
                      Start Time
                    </Label>
                    <Input
                      id="time-start"
                      type="time"
                      value={timeStart}
                      onChange={(e) => setTimeStart(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="time-end" className="text-xs text-muted-foreground">
                      End Time
                    </Label>
                    <Input
                      id="time-end"
                      type="time"
                      value={timeEnd}
                      onChange={(e) => setTimeEnd(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Separator className="my-4" />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Orders ({selectedOrders.size} selected)</Label>
              {availableOrders.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all-orders"
                    checked={selectedOrders.size === availableOrders.length && availableOrders.length > 0}
                    onCheckedChange={toggleAllOrders}
                  />
                  <Label htmlFor="select-all-orders" className="text-sm font-normal cursor-pointer">
                    Select All
                  </Label>
                </div>
              )}
            </div>
            <div className="border rounded-md max-h-64 overflow-y-auto">
              {availableOrders.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No pending orders with valid coordinates available
                </div>
              ) : (
                <div className="divide-y">
                  {availableOrders.map((order) => (
                    <div key={order.id} className="flex items-center space-x-3 p-3 hover:bg-accent">
                      <Checkbox checked={selectedOrders.has(order.id)} onCheckedChange={() => toggleOrder(order.id)} />
                      <div className="flex-1 text-sm">
                        <div className="font-medium">{order.customer_name}</div>
                        <div className="text-muted-foreground">
                          {order.address}
                          {order.city && `, ${order.city}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              isLoading ||
              selectedOrders.size === 0 ||
              (!multiDriverMode && !name) ||
              (multiDriverMode && selectedDrivers.size < 2)
            }
          >
            {isLoading ? "Creating..." : multiDriverMode ? "Create Routes" : "Create Route"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
