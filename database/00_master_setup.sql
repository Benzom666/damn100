-- ============================================================================
-- DELIVERY MANAGEMENT APP - MASTER DATABASE SETUP
-- ============================================================================
-- This script sets up the complete database schema for the delivery management
-- application. It can be run multiple times safely (idempotent).
--
-- Execute this entire file in the Supabase SQL Editor to set up your database.
-- ============================================================================

-- ============================================================================
-- SCRIPT 001: CREATE CORE TABLES
-- ============================================================================

-- Create profiles table with role-based access
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'driver')),
  display_name text,
  created_at timestamptz default now()
);

-- Create orders table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  address text not null,
  city text,
  state text,
  zip text,
  phone text,
  notes text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  status text not null default 'pending' check (status in ('pending', 'assigned', 'in_transit', 'delivered', 'failed')),
  route_id uuid references public.routes(id) on delete set null,
  stop_sequence integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create routes table
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  driver_id uuid references public.profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  total_stops integer default 0,
  completed_stops integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create pods (proof of delivery) table
create table if not exists public.pods (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  photo_url text,
  signature_url text,
  notes text,
  recipient_name text,
  delivered_at timestamptz default now()
);

-- Create stop_events table for tracking delivery attempts
create table if not exists public.stop_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('arrived', 'delivered', 'failed')),
  notes text,
  created_at timestamptz default now()
);

-- Create indexes for better query performance
create index if not exists idx_orders_route_id on public.orders(route_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_routes_driver_id on public.routes(driver_id);
create index if not exists idx_routes_status on public.routes(status);
create index if not exists idx_pods_order_id on public.pods(order_id);
create index if not exists idx_stop_events_order_id on public.stop_events(order_id);

-- Create updated_at trigger function
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Add triggers for updated_at
drop trigger if exists update_orders_updated_at on public.orders;
create trigger update_orders_updated_at before update on public.orders
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_routes_updated_at on public.routes;
create trigger update_routes_updated_at before update on public.routes
  for each row execute function public.update_updated_at_column();

-- ============================================================================
-- SCRIPT 002: ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable Row Level Security on all tables
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.routes enable row level security;
alter table public.pods enable row level security;
alter table public.stop_events enable row level security;

-- Create security definer function to prevent infinite recursion
create or replace function public.get_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$ 
  select role from public.profiles where id = auth.uid(); 
$$;

-- Revoke public access to the function
revoke all on function public.get_user_role() from public;
grant execute on function public.get_user_role() to authenticated;

-- Drop all existing policies to avoid conflicts
do $$ 
declare 
  r record; 
begin
  for r in select policyname, tablename from pg_policies 
    where schemaname='public' and tablename in ('profiles','orders','routes','pods','stop_events')
  loop 
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); 
  end loop;
end $$;

-- Profiles policies - simplified, no recursion
create policy "profiles_select_self"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Orders policies - use security definer function
create policy "orders_select"
  on public.orders for select
  using ( public.get_user_role() = 'admin' or 
          exists (select 1 from public.routes where id = orders.route_id and driver_id = auth.uid()) );

create policy "orders_insert"
  on public.orders for insert
  with check ( public.get_user_role() = 'admin' );

create policy "orders_update"
  on public.orders for update
  using ( public.get_user_role() = 'admin' or 
          exists (select 1 from public.routes where id = orders.route_id and driver_id = auth.uid()) );

create policy "orders_delete"
  on public.orders for delete
  using ( public.get_user_role() = 'admin' );

-- Routes policies - use security definer function
create policy "routes_select"
  on public.routes for select
  using ( public.get_user_role() = 'admin' or driver_id = auth.uid() );

create policy "routes_insert"
  on public.routes for insert
  with check ( public.get_user_role() = 'admin' );

create policy "routes_update"
  on public.routes for update
  using ( public.get_user_role() = 'admin' or driver_id = auth.uid() );

create policy "routes_delete"
  on public.routes for delete
  using ( public.get_user_role() = 'admin' );

-- PODs policies - use security definer function
create policy "pods_select"
  on public.pods for select
  using ( public.get_user_role() = 'admin' or driver_id = auth.uid() );

create policy "pods_insert"
  on public.pods for insert
  with check ( driver_id = auth.uid() );

-- Stop events policies - use security definer function
create policy "stop_events_select"
  on public.stop_events for select
  using ( public.get_user_role() = 'admin' or driver_id = auth.uid() );

create policy "stop_events_insert"
  on public.stop_events for insert
  with check ( driver_id = auth.uid() );

-- ============================================================================
-- SCRIPT 003: CREATE PROFILE TRIGGER
-- ============================================================================

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'driver'),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================================
-- SCRIPT 004: ADD GEOCODING COLUMNS
-- ============================================================================

-- Add geocoding metadata columns to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS geocode_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geocode_label     TEXT,
  ADD COLUMN IF NOT EXISTS geocode_status    TEXT,
  ADD COLUMN IF NOT EXISTS geocode_error     TEXT;

-- Ensure lat/lng are proper numeric types
ALTER TABLE public.orders
  ALTER COLUMN latitude TYPE DOUBLE PRECISION USING latitude::DOUBLE PRECISION,
  ALTER COLUMN longitude TYPE DOUBLE PRECISION USING longitude::DOUBLE PRECISION;

-- Add index for geocoding status queries
CREATE INDEX IF NOT EXISTS idx_orders_geocode_status ON public.orders(geocode_status);
CREATE INDEX IF NOT EXISTS idx_orders_geocode_error ON public.orders(geocode_error) WHERE geocode_error IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_coordinates ON public.orders(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================================================
-- SCRIPT 005: ADD VRP FIELDS
-- ============================================================================

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

-- ============================================================================
-- SCRIPT 006: ADD GLOBAL ROUTING FIELDS
-- ============================================================================

-- Add address fields to orders
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

-- Drop existing policies
do $$ 
declare 
  r record; 
begin
  for r in select policyname from pg_policies 
    where schemaname='public' and tablename='route_stops'
  loop 
    execute format('drop policy if exists %I on public.route_stops', r.policyname); 
  end loop;
end $$;

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

-- ============================================================================
-- SCRIPT 007: CREATE DRIVER POSITIONS
-- ============================================================================

-- Create driver_positions table for live tracking
create table if not exists public.driver_positions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  updated_at timestamptz default now(),
  unique(driver_id)
);

-- Create index for faster lookups
create index if not exists idx_driver_positions_driver_id on public.driver_positions(driver_id);
create index if not exists idx_driver_positions_updated_at on public.driver_positions(updated_at);

-- Enable RLS
alter table public.driver_positions enable row level security;

-- Drop existing policies
do $$ 
declare 
  r record; 
begin
  for r in select policyname from pg_policies 
    where schemaname='public' and tablename='driver_positions'
  loop 
    execute format('drop policy if exists %I on public.driver_positions', r.policyname); 
  end loop;
end $$;

-- Policies for driver_positions
create policy "driver_positions_select"
  on public.driver_positions for select
  using ( public.get_user_role() = 'admin' or driver_id = auth.uid() );

create policy "driver_positions_insert"
  on public.driver_positions for insert
  with check ( driver_id = auth.uid() );

create policy "driver_positions_update"
  on public.driver_positions for update
  using ( driver_id = auth.uid() );

-- Create function to upsert driver position
create or replace function public.upsert_driver_position(
  p_driver_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.driver_positions (driver_id, lat, lng, accuracy, updated_at)
  values (p_driver_id, p_lat, p_lng, p_accuracy, now())
  on conflict (driver_id)
  do update set
    lat = excluded.lat,
    lng = excluded.lng,
    accuracy = excluded.accuracy,
    updated_at = now();
end;
$$;

-- Grant execute permission
grant execute on function public.upsert_driver_position to authenticated;

-- ============================================================================
-- SCRIPT 009: ADD ROUTE METRICS
-- ============================================================================

-- Add route metrics columns (idempotent)
alter table routes
  add column if not exists distance_km double precision,
  add column if not exists duration_sec integer,
  add column if not exists drive_time_sec integer,
  add column if not exists service_time_sec integer,
  add column if not exists metrics_updated_at timestamptz;

-- Create index for faster metrics queries
create index if not exists idx_routes_metrics_updated_at on routes(metrics_updated_at);

-- Add comments for documentation
comment on column routes.distance_km is 'Total route distance in kilometers';
comment on column routes.duration_sec is 'Total route duration in seconds (drive + service time)';
comment on column routes.drive_time_sec is 'Total driving time in seconds';
comment on column routes.service_time_sec is 'Total service time in seconds';
comment on column routes.metrics_updated_at is 'Last time metrics were calculated';

-- ============================================================================
-- SCRIPT 010: POD EMAILS IDEMPOTENCY
-- ============================================================================

-- Create pod_emails table for idempotency tracking
create table if not exists public.pod_emails (
  pod_id uuid primary key references public.pods(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  to_email text not null,
  sent_at timestamptz not null default now(),
  provider_message_id text
);

-- Add index for faster lookups
create index if not exists idx_pod_emails_order_id on public.pod_emails(order_id);
create index if not exists idx_pod_emails_sent_at on public.pod_emails(sent_at desc);

-- RLS policies
alter table public.pod_emails enable row level security;

-- Drop existing policies
do $$ 
declare 
  r record; 
begin
  for r in select policyname from pg_policies 
    where schemaname='public' and tablename='pod_emails'
  loop 
    execute format('drop policy if exists %I on public.pod_emails', r.policyname); 
  end loop;
end $$;

-- Admins can read all email logs
create policy "admin_read_pod_emails"
on public.pod_emails for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

-- Drivers can read emails for their own deliveries
create policy "driver_read_own_pod_emails"
on public.pod_emails for select to authenticated
using (
  exists (
    select 1 from public.pods
    where pods.id = pod_emails.pod_id
      and pods.driver_id = auth.uid()
  )
);

-- Only server can insert (via service role)
create policy "service_insert_pod_emails"
on public.pod_emails for insert to authenticated
with check (false);

-- ============================================================================
-- SCRIPT 011: REQUIRE CUSTOMER EMAIL
-- ============================================================================

-- Add customer_email column to orders table
alter table public.orders
  add column if not exists customer_email text;

-- Clean up any empty strings
update public.orders set customer_email = null where customer_email = '';

-- Make customer_email required (only if column exists and has data)
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'customer_email'
  ) then
    -- Only set NOT NULL if all existing rows have a value
    if not exists (select 1 from public.orders where customer_email is null) then
      alter table public.orders alter column customer_email set not null;
    end if;
  end if;
end $$;

-- Add email format validation constraint
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'valid_email' 
    and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint valid_email
      check (customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  end if;
end $$;

-- Add index for email lookups
create index if not exists idx_orders_customer_email on public.orders(customer_email);

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
-- All tables, indexes, triggers, and RLS policies have been created.
-- You can now use the application!
-- ============================================================================
