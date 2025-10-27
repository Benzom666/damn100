export type UserRole = "admin" | "driver"

export type OrderStatus = "pending" | "assigned" | "in_transit" | "delivered" | "failed"

export type RouteStatus = "draft" | "active" | "completed"

export type EventType = "arrived" | "delivered" | "failed"

export interface Profile {
  id: string
  email: string
  role: UserRole
  display_name: string | null
  created_at: string
}

export interface Order {
  id: string
  customer_name: string
  customer_email: string // Added required customer_email field
  address: string
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  status: OrderStatus
  route_id: string | null
  stop_sequence: number | null
  created_at: string
  updated_at: string
}

export interface Route {
  id: string
  name: string
  driver_id: string | null
  status: RouteStatus
  total_stops: number
  completed_stops: number
  created_at: string
  updated_at: string
}

export interface POD {
  id: string
  order_id: string
  driver_id: string
  photo_url: string | null
  signature_url: string | null
  notes: string | null
  delivered_at: string
}

export interface StopEvent {
  id: string
  order_id: string
  driver_id: string
  event_type: EventType
  notes: string | null
  created_at: string
}
