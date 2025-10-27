"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { put } from "@vercel/blob"

type ActionResponse<T = void> = { success: true; data?: T } | { success: false; error: string; code?: string }

export async function updateStopStatus(
  orderId: string,
  status: "delivered" | "failed",
  notes?: string,
): Promise<ActionResponse> {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[v0] Auth error in updateStopStatus:", authError)
      return {
        success: false,
        error: "Your session has expired. Please log in again.",
        code: "AUTH_EXPIRED",
      }
    }

    const { error } = await supabase
      .from("orders")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (error) {
      console.error("[v0] Database error in updateStopStatus:", error)
      return {
        success: false,
        error: `Failed to update order status: ${error.message}`,
      }
    }

    const { error: eventError } = await supabase.from("stop_events").insert({
      order_id: orderId,
      driver_id: user.id,
      event_type: status,
      notes,
    })

    if (eventError) {
      console.error("[v0] Error creating stop event:", eventError)
      // Don't fail the whole operation if event logging fails
    }

    revalidatePath("/driver")
    return { success: true }
  } catch (error) {
    console.error("[v0] Unexpected error in updateStopStatus:", error)
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    }
  }
}

export async function savePOD(
  orderId: string,
  photoUrl?: string,
  signatureUrl?: string,
  notes?: string,
  recipientName?: string,
): Promise<ActionResponse> {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[v0] Auth error in savePOD:", authError)
      return {
        success: false,
        error: "Your session has expired. Please log in again.",
        code: "AUTH_EXPIRED",
      }
    }

    const podNotes = recipientName ? `Recipient: ${recipientName}\n${notes || ""}` : notes

    const { data: podData, error } = await supabase
      .from("pods")
      .insert({
        order_id: orderId,
        driver_id: user.id,
        photo_url: photoUrl,
        signature_url: signatureUrl,
        notes: podNotes,
        delivered_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (error) {
      console.error("[v0] Database error in savePOD:", error)
      return {
        success: false,
        error: `Failed to save proof of delivery: ${error.message}`,
      }
    }

    if (podData?.id && process.env.NEXT_PUBLIC_ENABLE_POD_EMAIL === "true") {
      console.log("[v0] [POD] Scheduling email send")
      // Use setTimeout to ensure this doesn't block the response
      setTimeout(() => {
        fetch("/api/pod-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, podId: podData.id }),
          cache: "no-store",
        })
          .then(async (r) => {
            const ct = r.headers.get("content-type") || ""
            const result = ct.includes("application/json") ? await r.json() : { ok: false, status: r.status }
            console.log("[v0] [POD] Email result:", result)
          })
          .catch((e) => {
            console.warn("[v0] [POD] Email failed (non-blocking):", e)
          })
      }, 0)
    }

    setTimeout(() => {
      revalidatePath("/driver")
    }, 100)

    return { success: true }
  } catch (error) {
    console.error("[v0] Unexpected error in savePOD:", error)
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    }
  }
}

export async function uploadToBlob(base64Data: string, filename: string, contentType: string) {
  try {
    // Mobile browsers don't support fetch() on data URLs, so we convert manually
    if (!base64Data || typeof base64Data !== "string") {
      throw new Error("Invalid base64 data provided")
    }

    // Extract base64 string from data URL
    const base64Parts = base64Data.split(",")
    if (base64Parts.length < 2) {
      throw new Error("Invalid data URL format")
    }

    const base64String = base64Parts[1]

    // Decode base64 to binary
    let byteString: string
    try {
      byteString = atob(base64String)
    } catch (e) {
      throw new Error("Failed to decode base64 data")
    }

    // Convert to byte array
    const byteArray = new Uint8Array(byteString.length)
    for (let i = 0; i < byteString.length; i++) {
      byteArray[i] = byteString.charCodeAt(i)
    }

    // Create blob with proper content type
    const blob = new Blob([byteArray], { type: contentType })

    // Validate blob size (optional: prevent extremely large uploads)
    if (blob.size === 0) {
      throw new Error("Generated blob is empty")
    }

    // Upload to Vercel Blob
    const result = await put(filename, blob, {
      access: "public",
      contentType,
    })

    if (!result.url) {
      throw new Error("Upload succeeded but no URL returned")
    }

    console.log("[v0] Successfully uploaded to blob:", result.url)
    return { url: result.url, error: null }
  } catch (error) {
    console.error("[v0] Error uploading to blob:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to upload file"
    return { url: null, error: errorMessage }
  }
}

export async function updateDriverPosition(lat: number, lng: number, accuracy?: number): Promise<ActionResponse> {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: "Authentication required",
        code: "AUTH_EXPIRED",
      }
    }

    const { error } = await supabase.rpc("upsert_driver_position", {
      p_driver_id: user.id,
      p_lat: lat,
      p_lng: lng,
      p_accuracy: accuracy || null,
    })

    if (error) {
      console.error("[v0] Error updating driver position:", error)
      return {
        success: false,
        error: "Failed to update position",
      }
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] Unexpected error in updateDriverPosition:", error)
    return {
      success: false,
      error: "An unexpected error occurred",
    }
  }
}
