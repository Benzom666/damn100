"use client"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CreateRouteDialog } from "./create-route-dialog"
import { PrintLabelsDialog } from "@/components/print-labels-dialog"
import { deleteRoute, updateRouteStatus } from "./actions"
import { useState } from "react"
import type { Order, Profile } from "@/lib/types"
import { Plus, Trash2, Play, CheckCircle, Printer, Eye } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Route {
  id: string
  name: string
  driver_id: string | null
  status: string
  total_stops: number
  completed_stops: number
  created_at: string
  profiles: { display_name: string | null; email: string } | null
}

interface RoutesTableProps {
  routes: Route[]
  orders: Order[]
  drivers: Profile[]
}

export function RoutesTable({ routes, orders, drivers }: RoutesTableProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false)
  const [selectedRouteForPrint, setSelectedRouteForPrint] = useState<Route | null>(null)
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null)
  const [activatingRouteId, setActivatingRouteId] = useState<string | null>(null)
  const router = useRouter()

  async function handleDeleteRoute(routeId: string) {
    if (confirm("Are you sure you want to delete this route? Orders will be reset to pending.")) {
      setDeletingRouteId(routeId)
      try {
        await deleteRoute(routeId)
        router.refresh()
      } catch (error) {
        console.error("[v0] Error deleting route:", error)
        alert("Failed to delete route. Please try again.")
      } finally {
        setDeletingRouteId(null)
      }
    }
  }

  async function handleActivateRoute(routeId: string) {
    setActivatingRouteId(routeId)
    try {
      await updateRouteStatus(routeId, "active")
      router.refresh()
    } catch (error) {
      console.error("[v0] Error activating route:", error)
      alert("Failed to activate route. Please try again.")
    } finally {
      setActivatingRouteId(null)
    }
  }

  async function handleCompleteRoute(routeId: string) {
    setActivatingRouteId(routeId)
    try {
      await updateRouteStatus(routeId, "completed")
      router.refresh()
    } catch (error) {
      console.error("[v0] Error completing route:", error)
      alert("Failed to complete route. Please try again.")
    } finally {
      setActivatingRouteId(null)
    }
  }

  function handlePrintRouteLabels(route: Route) {
    setSelectedRouteForPrint(route)
    setIsPrintDialogOpen(true)
  }

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

  const routeOrders = selectedRouteForPrint
    ? orders
        .filter((o) => o.route_id === selectedRouteForPrint.id)
        .sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0))
    : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Routes</h2>
          <p className="text-muted-foreground">Create and manage delivery routes</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Route
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Route Name</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Stops</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No routes found. Create your first route from pending orders.
                </TableCell>
              </TableRow>
            ) : (
              routes.map((route) => (
                <TableRow key={route.id}>
                  <TableCell className="font-medium">{route.name}</TableCell>
                  <TableCell>
                    {route.profiles ? route.profiles.display_name || route.profiles.email : "Unassigned"}
                  </TableCell>
                  <TableCell>{route.total_stops}</TableCell>
                  <TableCell>
                    {route.completed_stops} / {route.total_stops}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(route.status)}>{route.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/routes/${route.id}`}>
                        <Button variant="ghost" size="icon" title="View Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePrintRouteLabels(route)}
                        title="Print Labels"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      {route.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleActivateRoute(route.id)}
                          disabled={activatingRouteId === route.id}
                          title="Activate Route"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {route.status === "active" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCompleteRoute(route.id)}
                          disabled={activatingRouteId === route.id}
                          title="Complete Route"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteRoute(route.id)}
                        disabled={deletingRouteId === route.id}
                        title="Delete Route"
                      >
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

      <CreateRouteDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        orders={orders}
        drivers={drivers}
      />
      <PrintLabelsDialog
        open={isPrintDialogOpen}
        onOpenChange={setIsPrintDialogOpen}
        orders={routeOrders}
        routeName={selectedRouteForPrint?.name}
      />
    </div>
  )
}
