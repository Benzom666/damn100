import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, notes } = body

    console.log("[v0] [API] Marking order as failed:", orderId)

    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[v0] [API] Auth error:", authError)
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const { error: orderError } = await supabase
      .from("orders")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (orderError) {
      console.error("[v0] [API] Order update error:", orderError)
      return NextResponse.json({ success: false, error: "Failed to update order status" }, { status: 500 })
    }

    await supabase.from("stop_events").insert({
      order_id: orderId,
      driver_id: user.id,
      event_type: "failed",
      notes,
    })

    console.log("[v0] [API] Order marked as failed")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] [API] Unexpected error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 },
    )
  }
}
