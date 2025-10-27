import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { RouteDetailView } from "./route-detail-view"
import Link from "next/link"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AdminRouteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

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

  console.log("[v0] Fetching route details for ID:", id)

  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select("*, profiles(display_name, email)")
    .eq("id", id)
    .single()

  if (routeError) {
    console.error("[v0] Error fetching route:", routeError)
    redirect("/admin/routes")
  }

  if (!route) {
    console.log("[v0] Route not found:", id)
    redirect("/admin/routes")
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .eq("route_id", id)
    .order("stop_sequence", { ascending: true })

  if (ordersError) {
    console.error("[v0] Error fetching orders:", ordersError)
  }

  const { data: drivers } = await supabase.from("profiles").select("*").eq("role", "driver").order("display_name")

  console.log("[v0] Route loaded successfully:", route.name, "with", orders?.length || 0, "orders")

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
              <Link href="/admin/routes" className="text-sm font-medium">
                Routes
              </Link>
              <Link href="/admin/dispatch" className="text-sm text-muted-foreground hover:text-foreground">
                Dispatch
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{profile.display_name || profile.email}</span>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-6">
        <RouteDetailView route={route} orders={orders || []} drivers={drivers || []} />
      </main>
    </div>
  )
}
