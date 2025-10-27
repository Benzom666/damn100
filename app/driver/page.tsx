import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { Package, Clock } from "lucide-react"

export default async function DriverDashboard() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (!profile || profile.role !== "driver") {
    redirect("/admin")
  }

  const { data: routes } = await supabase
    .from("routes")
    .select("*, orders(count)")
    .eq("driver_id", user.id)
    .in("status", ["active", "pending"])
    .order("created_at", { ascending: false })

  // Get order counts for each route
  const routesWithStats = await Promise.all(
    (routes || []).map(async (route) => {
      const { data: orders } = await supabase.from("orders").select("status").eq("route_id", route.id)

      const total = orders?.length || 0
      const completed = orders?.filter((o) => o.status === "delivered").length || 0
      const failed = orders?.filter((o) => o.status === "failed").length || 0

      return {
        ...route,
        totalStops: total,
        completedStops: completed,
        failedStops: failed,
      }
    }),
  )

  async function signOut() {
    "use server"
    const supabase = await createServerClient()
    await supabase.auth.signOut()
    redirect("/auth/login")
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-semibold">Driver Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{profile.display_name || profile.email}</span>
            <form action={signOut}>
              <Button variant="outline" size="sm">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 max-w-2xl">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Welcome, {profile.display_name || "Driver"}</h2>
            <p className="text-muted-foreground">View your assigned routes and deliveries</p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Your Routes</h3>
            {routesWithStats.length === 0 ? (
              <Card className="p-6 text-center">
                <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No active routes assigned yet</p>
              </Card>
            ) : (
              routesWithStats.map((route) => (
                <Link key={route.id} href={`/driver/routes/${route.id}`}>
                  <Card className="p-4 hover:bg-accent transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-lg">{route.name}</h4>
                        <p className="text-sm text-muted-foreground capitalize">Status: {route.status}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {route.completedStops + route.failedStops}/{route.totalStops}
                        </div>
                        <div className="text-xs text-muted-foreground">stops</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-muted rounded p-2 text-center">
                        <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <div className="text-sm font-medium">
                          {route.totalStops - route.completedStops - route.failedStops}
                        </div>
                        <div className="text-xs text-muted-foreground">Pending</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-950 rounded p-2 text-center">
                        <div className="text-sm font-medium text-green-700 dark:text-green-400">
                          {route.completedStops}
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-500">Delivered</div>
                      </div>
                      <div className="bg-red-50 dark:bg-red-950 rounded p-2 text-center">
                        <div className="text-sm font-medium text-red-700 dark:text-red-400">{route.failedStops}</div>
                        <div className="text-xs text-red-600 dark:text-red-500">Failed</div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
