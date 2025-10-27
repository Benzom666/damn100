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
