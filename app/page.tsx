import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get user profile to determine role
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  // Check if there are database errors
  if (error) {
    console.log("[v0] Profile fetch error:", error)

    // @ts-ignore - error might have code or message properties
    const errorCode = error.code || error.error_code
    // @ts-ignore
    const errorMessage = error.message || error.error_description || ""

    if (errorCode === "42P17" || errorMessage.includes("infinite recursion")) {
      console.log("[v0] RLS infinite recursion detected, redirecting to /setup")
      redirect("/setup?error=rls_recursion")
    }

    // PostgreSQL error code PGRST205 means relation (table) does not exist
    if (errorCode === "PGRST205" || errorMessage.includes("Could not find the table")) {
      console.log("[v0] Database not set up, redirecting to /setup")
      redirect("/setup")
    }

    // For other errors, redirect to login
    console.log("[v0] Other error, redirecting to login")
    redirect("/auth/login")
  }

  if (!profile) {
    redirect("/auth/login")
  }

  // Redirect based on role
  if (profile.role === "admin") {
    redirect("/admin")
  } else {
    redirect("/driver")
  }
}
