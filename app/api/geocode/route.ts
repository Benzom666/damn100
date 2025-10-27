// app/api/geocode/route.ts
// API endpoint for geocoding orders

import { type NextRequest, NextResponse } from "next/server"
import { ensureOrderCoordinates } from "@/lib/ensure-coords"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { orderIds } = body

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: "orderIds array required" }, { status: 400 })
    }

    const result = await ensureOrderCoordinates(orderIds)

    return NextResponse.json({
      success: true,
      geocoded: result.success.length,
      failed: result.failed.length,
      failures: result.failed,
    })
  } catch (error) {
    console.error("[v0] Geocode API error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Geocoding failed" }, { status: 500 })
  }
}
