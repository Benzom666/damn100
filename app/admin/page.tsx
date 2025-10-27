import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Package, Route, Radio } from "lucide-react"

export default async function AdminDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (!profile || profile.role !== "admin") {
    redirect("/driver")
  }

  // Get stats
  const { count: totalOrders } = await supabase.from("orders").select("*", { count: "exact", head: true })
  const { count: pendingOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
  const { count: activeRoutes } = await supabase
    .from("routes")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")

  async function signOut() {
    "use server"
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect("/auth/login")
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-xl font-semibold">
              Admin Dashboard
            </Link>
            <nav className="flex gap-4">
              <Link href="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground">
                Orders
              </Link>
              <Link href="/admin/routes" className="text-sm text-muted-foreground hover:text-foreground">
                Routes
              </Link>
              <Link href="/admin/dispatch" className="text-sm text-muted-foreground hover:text-foreground">
                Dispatch
              </Link>
            </nav>
          </div>
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
      <main className="flex-1 container mx-auto p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Welcome, {profile.display_name || "Admin"}</h2>
            <p className="text-muted-foreground">Manage orders, routes, and drivers from your dashboard</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders || 0}</div>
                <p className="text-xs text-muted-foreground">{pendingOrders || 0} pending</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Routes</CardTitle>
                <Route className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeRoutes || 0}</div>
                <p className="text-xs text-muted-foreground">Currently in progress</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Dispatch Monitor</CardTitle>
                <Radio className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Live</div>
                <p className="text-xs text-muted-foreground">Real-time tracking</p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/admin/orders">
              <Card className="cursor-pointer hover:bg-accent transition-colors">
                <CardHeader>
                  <CardTitle>Orders</CardTitle>
                  <CardDescription>Create, edit, and manage delivery orders</CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link href="/admin/routes">
              <Card className="cursor-pointer hover:bg-accent transition-colors">
                <CardHeader>
                  <CardTitle>Routes</CardTitle>
                  <CardDescription>Create and optimize delivery routes</CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link href="/admin/dispatch">
              <Card className="cursor-pointer hover:bg-accent transition-colors">
                <CardHeader>
                  <CardTitle>Dispatch</CardTitle>
                  <CardDescription>Monitor active deliveries in real-time</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
