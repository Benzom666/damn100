"use server"

import { createClient } from "@/lib/supabase/server"
import { geocodeAddress, geocodeBatch } from "@/lib/geocoding"
import { revalidatePath } from "next/cache"

function isValidEmail(email: string): boolean {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)
}

async function hasCustomerEmailColumn(supabase: any): Promise<boolean> {
  try {
    const { error } = await supabase.from("orders").select("customer_email").limit(1)
    return !error || !error.message.includes("customer_email")
  } catch {
    return false
  }
}

export async function createOrder(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const customerName = formData.get("customer_name") as string
  const customerEmail = formData.get("customer_email") as string
  const address = formData.get("address") as string
  const city = formData.get("city") as string
  const state = formData.get("state") as string
  const zip = formData.get("zip") as string
  const phone = formData.get("phone") as string
  const notes = formData.get("notes") as string

  const hasEmailColumn = await hasCustomerEmailColumn(supabase)

  if (hasEmailColumn) {
    if (!customerEmail) {
      throw new Error("Customer email is required for POD notifications")
    }
    if (!isValidEmail(customerEmail)) {
      throw new Error("Invalid customer email format")
    }
  }

  // Geocode the address
  const geoResult = await geocodeAddress(address, city, state, zip)

  const orderData: any = {
    customer_name: customerName,
    address,
    city: city || null,
    state: state || null,
    zip: zip || null,
    phone: phone || null,
    notes: notes || null,
    latitude: geoResult?.latitude || null,
    longitude: geoResult?.longitude || null,
    status: "pending",
  }

  if (hasEmailColumn && customerEmail) {
    orderData.customer_email = customerEmail
  }

  const { error } = await supabase.from("orders").insert(orderData)

  if (error) throw error

  revalidatePath("/admin/orders")
}

export async function updateOrder(orderId: string, formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const customerName = formData.get("customer_name") as string
  const customerEmail = formData.get("customer_email") as string
  const address = formData.get("address") as string
  const city = formData.get("city") as string
  const state = formData.get("state") as string
  const zip = formData.get("zip") as string
  const phone = formData.get("phone") as string
  const notes = formData.get("notes") as string

  const hasEmailColumn = await hasCustomerEmailColumn(supabase)

  if (hasEmailColumn) {
    if (!customerEmail) {
      throw new Error("Customer email is required for POD notifications")
    }
    if (!isValidEmail(customerEmail)) {
      throw new Error("Invalid customer email format")
    }
  }

  // Geocode the address
  const geoResult = await geocodeAddress(address, city, state, zip)

  const updateData: any = {
    customer_name: customerName,
    address,
    city: city || null,
    state: state || null,
    zip: zip || null,
    phone: phone || null,
    notes: notes || null,
    latitude: geoResult?.latitude || null,
    longitude: geoResult?.longitude || null,
  }

  if (hasEmailColumn && customerEmail) {
    updateData.customer_email = customerEmail
  }

  const { error } = await supabase.from("orders").update(updateData).eq("id", orderId)

  if (error) throw error

  revalidatePath("/admin/orders")
}

export async function deleteOrder(orderId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { error } = await supabase.from("orders").delete().eq("id", orderId)

  if (error) throw error

  revalidatePath("/admin/orders")
}

export async function bulkDeleteOrders(orderIds: string[]) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  console.log("[v0] [BULK_DELETE] Deleting", orderIds.length, "orders")
  console.log("[v0] [BULK_DELETE] User:", user.id)

  const { error } = await supabase.from("orders").delete().in("id", orderIds)

  if (error) {
    console.error("[v0] [BULK_DELETE] Error:", error)
    throw error
  }

  console.log("[v0] [BULK_DELETE] ✓ Successfully deleted", orderIds.length, "orders")

  revalidatePath("/admin/orders")

  return { deleted: orderIds.length }
}

export async function importOrdersFromCSV(csvData: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const hasEmailColumn = await hasCustomerEmailColumn(supabase)

  // Parse CSV
  const lines = csvData.trim().split("\n")
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())

  if (hasEmailColumn && !headers.includes("customer_email")) {
    throw new Error("CSV must include 'customer_email' column to enable POD notifications")
  }

  const ordersToGeocode: Array<{
    rowIndex: number
    customer_name: string
    customer_email?: string
    address: string
    city?: string
    state?: string
    zip?: string
    phone?: string
    notes?: string
  }> = []

  const errors: string[] = []

  // Parse all rows first
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim())
    const row: Record<string, string> = {}

    headers.forEach((header, index) => {
      row[header] = values[index] || ""
    })

    if (!row.customer_name || !row.address) {
      errors.push(`Row ${i + 1}: Missing customer_name or address`)
      continue
    }

    if (hasEmailColumn) {
      if (!row.customer_email) {
        errors.push(`Row ${i + 1}: Missing customer_email (required for POD notifications)`)
        continue
      }

      if (!isValidEmail(row.customer_email)) {
        errors.push(`Row ${i + 1}: Invalid customer_email format: ${row.customer_email}`)
        continue
      }
    }

    ordersToGeocode.push({
      rowIndex: i + 1,
      customer_name: row.customer_name,
      customer_email: row.customer_email,
      address: row.address,
      city: row.city,
      state: row.state,
      zip: row.zip,
      phone: row.phone,
      notes: row.notes,
    })
  }

  if (errors.length > 0) {
    return {
      imported: 0,
      errors,
    }
  }

  console.log(`[v0] Geocoding ${ordersToGeocode.length} addresses in batches...`)

  // Batch geocode all addresses
  const geocodeResults = await geocodeBatch(
    ordersToGeocode.map((o) => ({
      address: o.address,
      city: o.city,
      state: o.state,
      zip: o.zip,
    })),
    25,
  )

  // Build final orders array with geocoding results
  const orders = []
  const failedGeocodeRows: number[] = []
  let successCount = 0

  for (let i = 0; i < ordersToGeocode.length; i++) {
    const order = ordersToGeocode[i]
    const geoResult = geocodeResults[i]

    if (!geoResult) {
      failedGeocodeRows.push(order.rowIndex)
    }

    const orderData: any = {
      customer_name: order.customer_name,
      address: order.address,
      city: order.city || null,
      state: order.state || null,
      zip: order.zip || null,
      phone: order.phone || null,
      notes: order.notes || null,
      latitude: geoResult?.latitude || null,
      longitude: geoResult?.longitude || null,
      status: "pending",
    }

    if (hasEmailColumn && order.customer_email) {
      orderData.customer_email = order.customer_email
    }

    orders.push(orderData)
    successCount++
  }

  // Insert all orders
  if (orders.length > 0) {
    const { error } = await supabase.from("orders").insert(orders)
    if (error) throw error
  }

  if (failedGeocodeRows.length > 0) {
    errors.push(
      `${failedGeocodeRows.length} order(s) imported without coordinates (rows: ${failedGeocodeRows.join(", ")}). These orders cannot be added to routes until geocoded.`,
    )
  }

  revalidatePath("/admin/orders")

  return {
    imported: successCount,
    errors,
  }
}
