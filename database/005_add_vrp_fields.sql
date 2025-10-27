-- Add VRP (Vehicle Routing Problem) fields for advanced route optimization
-- Safe to run repeatedly (uses IF NOT EXISTS)

-- Driver/vehicle fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vehicle_capacity INT,
  ADD COLUMN IF NOT EXISTS shift_start TIME,
  ADD COLUMN IF NOT EXISTS shift_end TIME,
  ADD COLUMN IF NOT EXISTS depot_lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS depot_lng NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS driver_skills TEXT[];

-- Order fields for time windows, service time, skills, and quantity
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tw_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tw_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_seconds INT,
  ADD COLUMN IF NOT EXISTS service_minutes INT,
  ADD COLUMN IF NOT EXISTS required_skills TEXT[],
  ADD COLUMN IF NOT EXISTS quantity INT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_tw_start ON public.orders(tw_start);
CREATE INDEX IF NOT EXISTS idx_orders_tw_end ON public.orders(tw_end);
CREATE INDEX IF NOT EXISTS idx_profiles_shift ON public.profiles(shift_start, shift_end);
