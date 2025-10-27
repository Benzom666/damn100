"use client"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { OrderDialog } from "./order-dialog"
import { CSVImportDialog } from "./csv-import-dialog"
import { PrintLabelsDialog } from "@/components/print-labels-dialog"
import { deleteOrder, bulkDeleteOrders } from "./actions"
import { useState } from "react"
import type { Order } from "@/lib/types"
import { Pencil, Trash2, Plus, Upload, Printer } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface OrdersTableProps {
  orders: Order[]
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false)
  const [isCSVDialogOpen, setIsCSVDialogOpen] = useState(false)
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  function handleCreateOrder() {
    setSelectedOrder(null)
    setIsOrderDialogOpen(true)
  }

  function handleEditOrder(order: Order) {
    setSelectedOrder(order)
    setIsOrderDialogOpen(true)
  }

  async function handleDeleteOrder(orderId: string) {
    if (confirm("Are you sure you want to delete this order?")) {
      await deleteOrder(orderId)
    }
  }

  function toggleOrderSelection(orderId: string) {
    const newSelection = new Set(selectedOrderIds)
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId)
    } else {
      newSelection.add(orderId)
    }
    setSelectedOrderIds(newSelection)
  }

  function toggleAllOrders() {
    if (selectedOrderIds.size === orders.length) {
      setSelectedOrderIds(new Set())
    } else {
      setSelectedOrderIds(new Set(orders.map((o) => o.id)))
    }
  }

  function handlePrintLabels() {
    if (selectedOrderIds.size === 0) {
      alert("Please select at least one order to print labels.")
      return
    }
    setIsPrintDialogOpen(true)
  }

  async function handleBulkDelete() {
    if (selectedOrderIds.size === 0) return

    const count = selectedOrderIds.size
    const confirmed = confirm(
      `Are you sure you want to delete ${count} order${count > 1 ? "s" : ""}? This action cannot be undone.`,
    )

    if (!confirmed) return

    setIsDeleting(true)
    try {
      await bulkDeleteOrders(Array.from(selectedOrderIds))
      toast({
        title: "Orders deleted",
        description: `Successfully deleted ${count} order${count > 1 ? "s" : ""}.`,
      })
      setSelectedOrderIds(new Set())
    } catch (error) {
      console.error("[v0] Bulk delete error:", error)
      toast({
        title: "Error",
        description: "Failed to delete orders. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const selectedOrders = orders.filter((o) => selectedOrderIds.has(o.id))

  function getStatusColor(status: string) {
    switch (status) {
      case "pending":
        return "secondary"
      case "assigned":
        return "default"
      case "in_transit":
        return "default"
      case "delivered":
        return "default"
      case "failed":
        return "destructive"
      default:
        return "secondary"
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Orders</h2>
          <p className="text-muted-foreground">Manage delivery orders</p>
        </div>
        <div className="flex gap-2">
          {selectedOrderIds.size > 0 && (
            <>
              <Button onClick={handleBulkDelete} variant="destructive" disabled={isDeleting}>
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? "Deleting..." : `Delete (${selectedOrderIds.size})`}
              </Button>
              <Button onClick={handlePrintLabels} variant="outline">
                <Printer className="mr-2 h-4 w-4" />
                Print Labels ({selectedOrderIds.size})
              </Button>
            </>
          )}
          <Button onClick={() => setIsCSVDialogOpen(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={handleCreateOrder}>
            <Plus className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedOrderIds.size === orders.length && orders.length > 0}
                  onCheckedChange={toggleAllOrders}
                />
              </TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Route</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No orders found. Create your first order or import from CSV.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedOrderIds.has(order.id)}
                      onCheckedChange={() => toggleOrderSelection(order.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{order.customer_name}</TableCell>
                  <TableCell>{order.address}</TableCell>
                  <TableCell>{order.city || "-"}</TableCell>
                  <TableCell>{order.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(order.status)}>{order.status}</Badge>
                  </TableCell>
                  <TableCell>{order.route_id ? `Stop ${order.stop_sequence}` : "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEditOrder(order)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <OrderDialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen} order={selectedOrder} />
      <CSVImportDialog open={isCSVDialogOpen} onOpenChange={setIsCSVDialogOpen} />
      <PrintLabelsDialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen} orders={selectedOrders} />
    </div>
  )
}
