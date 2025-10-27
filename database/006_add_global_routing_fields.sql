-- Add missing fields for global routing with zero regional bias
-- Run this in Supabase SQL Editor

-- Add geocoding and address fields to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS address_line1 text,
ADD COLUMN IF NOT EXISTS delivery_address text,
ADD COLUMN IF NOT EXISTS full_address text,
ADD COLUMN IF NOT EXISTS state_province text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS country text;

-- Add route optimization fields to routes
ALTER TABLE public.routes
ADD COLUMN IF NOT EXISTS total_distance_m integer,
ADD COLUMN IF NOT EXISTS total_duration_s integer,
ADD COLUMN IF NOT EXISTS vehicle_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS depot_lat numeric,
ADD COLUMN IF NOT EXISTS depot_lng numeric,
ADD COLUMN IF NOT EXISTS raw_solution_json jsonb;

-- Create route_stops table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES public.routes(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  eta timestamp with time zone,
  etd timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON public.route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order_id ON public.route_stops(order_id);

-- Enable RLS on route_stops
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

-- RLS policies for route_stops
CREATE POLICY "Admins can manage route_stops"
  ON public.route_stops
  FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Drivers can view their route_stops"
  ON public.route_stops
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.routes
      WHERE routes.id = route_stops.route_id
      AND routes.driver_id = auth.uid()
    )
  );
