import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all driver positions
    const { data: positions, error } = await supabase
      .from("driver_positions")
      .select("*, profiles(display_name, email)")

    if (error) {
      console.error("[v0] Error fetching driver positions:", error)
      return NextResponse.json({ error: "Failed to fetch positions" }, { status: 500 })
    }

    return NextResponse.json({ positions })
  } catch (error) {
    console.error("[v0] Unexpected error in driver-positions API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
