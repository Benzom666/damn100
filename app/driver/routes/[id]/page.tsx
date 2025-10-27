import { createServerClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { RouteDetail } from "./route-detail"

export default async function DriverRoutePage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const { id } = params
  const supabase = await createServerClient()

  console.log("[v0] [DRIVER_ROUTE] Loading route:", id)

  try {
    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.log("[v0] [DRIVER_ROUTE] No user, redirecting to login")
      redirect("/auth/login")
    }

    console.log("[v0] [DRIVER_ROUTE] User:", user.id)

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    console.log("[v0] [DRIVER_ROUTE] Profile role:", profile?.role, "Error:", profileError?.message)

    if (profileError) {
      console.error("[v0] [DRIVER_ROUTE] Profile error:", profileError)
      throw new Error("Failed to load profile")
    }

    if (!profile || profile.role !== "driver") {
      console.log("[v0] [DRIVER_ROUTE] Not a driver, redirecting to admin")
      redirect("/admin")
    }

    const { data: route, error: routeError } = await supabase
      .from("routes")
      .select("*")
      .eq("id", id)
      .eq("driver_id", user.id)
      .maybeSingle()

    console.log("[v0] [DRIVER_ROUTE] Route query result:", { route: route?.name, error: routeError?.message })

    if (routeError) {
      console.error("[v0] [DRIVER_ROUTE] Route error:", routeError)
      throw new Error("Failed to load route")
    }

    if (!route) {
      console.log("[v0] [DRIVER_ROUTE] Route not found")
      notFound()
    }

    // Get orders for this route
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .eq("route_id", id)
      .order("stop_sequence", { ascending: true })

    console.log("[v0] [DRIVER_ROUTE] Orders loaded:", orders?.length, "Error:", ordersError?.message)

    if (ordersError) {
      console.error("[v0] [DRIVER_ROUTE] Orders error:", ordersError)
      throw new Error("Failed to load orders")
    }

    return <RouteDetail route={route} orders={orders || []} />
  } catch (error) {
    console.error("[v0] [DRIVER_ROUTE] Fatal error:", error)
    // Re-throw to show error page
    throw error
  }
}
