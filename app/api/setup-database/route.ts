import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const tables = ["profiles", "orders", "routes", "pods", "stop_events"]
    const missingTables: string[] = []

    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select("count").limit(0)

        // Check if error indicates table doesn't exist
        if (error) {
          const errorMessage = error.message || ""
          const errorCode = (error as any).code || ""

          if (errorCode === "PGRST205" || errorMessage.includes("Could not find the table")) {
            missingTables.push(table)
          } else {
            // Some other error occurred
            console.error(`[v0] Error checking table ${table}:`, error)
          }
        }
      } catch (err) {
        console.error(`[v0] Exception checking table ${table}:`, err)
        missingTables.push(table)
      }
    }

    if (missingTables.length > 0) {
      return NextResponse.json(
        {
          success: false,
          tablesExist: false,
          message: `Database tables not found: ${missingTables.join(", ")}. Please run the SQL scripts.`,
          missingTables,
        },
        { status: 200 },
      )
    }

    return NextResponse.json({
      success: true,
      tablesExist: true,
      message: "Database is set up correctly! All tables exist.",
    })
  } catch (error: any) {
    console.error("[v0] Database test error:", error)
    return NextResponse.json(
      {
        success: false,
        tablesExist: false,
        error: "Failed to test database connection",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
