"use client"

import type React from "react"

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
import { Textarea } from "@/components/ui/textarea"
import { createOrder, updateOrder } from "./actions"
import { useState } from "react"
import type { Order } from "@/lib/types"

interface OrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order?: Order | null
}

export function OrderDialog({ open, onOpenChange, order }: OrderDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      if (order) {
        await updateOrder(order.id, formData)
      } else {
        await createOrder(formData)
      }
      onOpenChange(false)
    } catch (error) {
      console.error("Error saving order:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? "Edit Order" : "Create Order"}</DialogTitle>
          <DialogDescription>
            {order ? "Update the order details below." : "Add a new delivery order to the system."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input id="customer_name" name="customer_name" defaultValue={order?.customer_name} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customer_email">
                Customer Email <span className="text-red-600">*</span>
              </Label>
              <Input
                id="customer_email"
                name="customer_email"
                type="email"
                defaultValue={order?.customer_email}
                placeholder="customer@example.com"
                required
              />
              <p className="text-xs text-muted-foreground">Required for POD email notifications</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address *</Label>
              <Input id="address" name="address" defaultValue={order?.address} required />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" defaultValue={order?.city || ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" name="state" defaultValue={order?.state || ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="zip">ZIP</Label>
                <Input id="zip" name="zip" defaultValue={order?.zip || ""} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" defaultValue={order?.phone || ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" defaultValue={order?.notes || ""} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : order ? "Update Order" : "Create Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
