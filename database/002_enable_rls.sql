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
