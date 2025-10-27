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
create trigger update_orders_updated_at before update on public.orders
  for each row execute function public.update_updated_at_column();

create trigger update_routes_updated_at before update on public.routes
  for each row execute function public.update_updated_at_column();
