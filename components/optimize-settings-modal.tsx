"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

export interface OptimizeSettings {
  startFromWarehouse: boolean
  warehouseLat: string
  warehouseLng: string
  returnToWarehouse: boolean
  maxStopsPerRoute: string
  vehicleCapacity: string
  shiftStart: string
  shiftEnd: string
}

interface OptimizeSettingsModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (settings: OptimizeSettings) => void
}

export function OptimizeSettingsModal({ open, onClose, onConfirm }: OptimizeSettingsModalProps) {
  const [settings, setSettings] = useState<OptimizeSettings>({
    startFromWarehouse: true,
    warehouseLat: "45.4215",
    warehouseLng: "-75.6972",
    returnToWarehouse: true,
    maxStopsPerRoute: "50",
    vehicleCapacity: "100",
    shiftStart: "08:00",
    shiftEnd: "18:00",
  })

  const handleChange = (key: keyof OptimizeSettings, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Route Optimization Settings</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure HERE Tour Planning parameters. Optional fields will default automatically.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Start from warehouse */}
          <div className="flex items-center justify-between">
            <Label>Start from warehouse?</Label>
            <Switch
              checked={settings.startFromWarehouse}
              onCheckedChange={(val) => handleChange("startFromWarehouse", val)}
            />
          </div>

          {settings.startFromWarehouse && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Warehouse Latitude</Label>
                <Input
                  type="text"
                  value={settings.warehouseLat}
                  onChange={(e) => handleChange("warehouseLat", e.target.value)}
                />
              </div>
              <div>
                <Label>Warehouse Longitude</Label>
                <Input
                  type="text"
                  value={settings.warehouseLng}
                  onChange={(e) => handleChange("warehouseLng", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Return to warehouse */}
          <div className="flex items-center justify-between">
            <Label>Return to warehouse?</Label>
            <Switch
              checked={settings.returnToWarehouse}
              onCheckedChange={(val) => handleChange("returnToWarehouse", val)}
            />
          </div>

          {/* Capacity + stops */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Max stops per route</Label>
              <Input
                type="number"
                placeholder="50"
                value={settings.maxStopsPerRoute}
                onChange={(e) => handleChange("maxStopsPerRoute", e.target.value)}
              />
            </div>
            <div>
              <Label>Vehicle capacity</Label>
              <Input
                type="number"
                placeholder="100"
                value={settings.vehicleCapacity}
                onChange={(e) => handleChange("vehicleCapacity", e.target.value)}
              />
            </div>
          </div>

          {/* Time windows */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Shift start</Label>
              <Input
                type="time"
                value={settings.shiftStart}
                onChange={(e) => handleChange("shiftStart", e.target.value)}
              />
            </div>
            <div>
              <Label>Shift end</Label>
              <Input type="time" value={settings.shiftEnd} onChange={(e) => handleChange("shiftEnd", e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(settings)}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
