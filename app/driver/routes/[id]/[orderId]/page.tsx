import { createServerClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { StopDetail } from "./stop-detail"

export default async function DriverStopPage(props: {
  params: Promise<{ id: string; orderId: string }>
}) {
  const params = await props.params
  const { id: routeId, orderId } = params
  const supabase = await createServerClient()

  console.log("[v0] [DRIVER_STOP] Loading stop:", { routeId, orderId })

  try {
    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.log("[v0] [DRIVER_STOP] No user, redirecting to login")
      redirect("/auth/login")
    }

    console.log("[v0] [DRIVER_STOP] User:", user.id)

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    console.log("[v0] [DRIVER_STOP] Profile:", { role: profile?.role, error: profileError?.message })

    if (profileError) {
      console.error("[v0] [DRIVER_STOP] Profile error:", profileError)
      throw new Error("Failed to load profile")
    }

    if (!profile || profile.role !== "driver") {
      console.log("[v0] [DRIVER_STOP] Not a driver, redirecting to admin")
      redirect("/admin")
    }

    const { data: route, error: routeError } = await supabase
      .from("routes")
      .select("*")
      .eq("id", routeId)
      .eq("driver_id", user.id)
      .maybeSingle()

    console.log("[v0] [DRIVER_STOP] Route:", { name: route?.name, error: routeError?.message })

    if (routeError) {
      console.error("[v0] [DRIVER_STOP] Route error:", routeError)
      throw new Error("Failed to load route")
    }

    if (!route) {
      console.log("[v0] [DRIVER_STOP] Route not found")
      notFound()
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("route_id", routeId)
      .maybeSingle()

    console.log("[v0] [DRIVER_STOP] Order:", { id: order?.id, error: orderError?.message })

    if (orderError) {
      console.error("[v0] [DRIVER_STOP] Order error:", orderError)
      throw new Error("Failed to load order")
    }

    if (!order) {
      console.log("[v0] [DRIVER_STOP] Order not found")
      notFound()
    }

    const { data: existingPod, error: podError } = await supabase
      .from("pods")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle()

    console.log("[v0] [DRIVER_STOP] Existing POD:", { exists: !!existingPod, error: podError?.message })

    if (podError) {
      console.error("[v0] [DRIVER_STOP] POD error:", podError)
      // Don't throw error for POD, just log it
    }

    return <StopDetail order={order} routeName={route.name} routeId={routeId} existingPod={existingPod} />
  } catch (error) {
    console.error("[v0] [DRIVER_STOP] Fatal error:", error)
    // Re-throw to show error page
    throw error
  }
}
