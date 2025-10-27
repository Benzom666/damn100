"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, XCircle, Loader2, Database, Copy, Check, ExternalLink } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const SQL_SCRIPTS = {
  "001_create_tables.sql": `-- Create profiles table with role-based access
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'driver')),
  display_name text,
  created_at timestamptz default now()
);

-- Create routes table (must be before orders due to foreign key)
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

-- Create pods (proof of delivery) table
create table if not exists public.pods (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  photo_url text,
  signature_url text,
  recipient_name text,
  notes text,
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
`,

  "002_enable_rls.sql": `-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.routes enable row level security;
alter table public.pods enable row level security;
alter table public.stop_events enable row level security;

-- Create a security definer function to get user role (bypasses RLS to prevent recursion)
create or replace function public.get_user_role()
returns text
language sql
security definer
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Profiles policies
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.get_user_role() = 'admin');

-- Orders policies
drop policy if exists "Admins can do everything with orders" on public.orders;
create policy "Admins can do everything with orders"
  on public.orders for all
  using (public.get_user_role() = 'admin');

drop policy if exists "Drivers can view their assigned orders" on public.orders;
create policy "Drivers can view their assigned orders"
  on public.orders for select
  using (
    public.get_user_role() = 'driver' and
    exists (
      select 1 from public.routes r
      where r.id = orders.route_id and r.driver_id = auth.uid()
    )
  );

drop policy if exists "Drivers can update their assigned orders" on public.orders;
create policy "Drivers can update their assigned orders"
  on public.orders for update
  using (
    public.get_user_role() = 'driver' and
    exists (
      select 1 from public.routes r
      where r.id = orders.route_id and r.driver_id = auth.uid()
    )
  );

-- Routes policies
drop policy if exists "Admins can do everything with routes" on public.routes;
create policy "Admins can do everything with routes"
  on public.routes for all
  using (public.get_user_role() = 'admin');

drop policy if exists "Drivers can view their assigned routes" on public.routes;
create policy "Drivers can view their assigned routes"
  on public.routes for select
  using (
    driver_id = auth.uid() or
    public.get_user_role() = 'admin'
  );

-- PODs policies
drop policy if exists "Admins can view all PODs" on public.pods;
create policy "Admins can view all PODs"
  on public.pods for select
  using (public.get_user_role() = 'admin');

drop policy if exists "Drivers can insert PODs for their orders" on public.pods;
create policy "Drivers can insert PODs for their orders"
  on public.pods for insert
  with check (
    driver_id = auth.uid() and
    public.get_user_role() = 'driver'
  );

drop policy if exists "Drivers can view their own PODs" on public.pods;
create policy "Drivers can view their own PODs"
  on public.pods for select
  using (driver_id = auth.uid());

-- Stop events policies
drop policy if exists "Admins can view all stop events" on public.stop_events;
create policy "Admins can view all stop events"
  on public.stop_events for select
  using (public.get_user_role() = 'admin');

drop policy if exists "Drivers can insert stop events for their orders" on public.stop_events;
create policy "Drivers can insert stop events for their orders"
  on public.stop_events for insert
  with check (
    driver_id = auth.uid() and
    public.get_user_role() = 'driver'
  );

drop policy if exists "Drivers can view their own stop events" on public.stop_events;
create policy "Drivers can view their own stop events"
  on public.stop_events for select
  using (driver_id = auth.uid());`,

  "003_create_profile_trigger.sql": `-- Create trigger function for updating timestamps
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for orders and routes
drop trigger if exists update_orders_updated_at on public.orders;
create trigger update_orders_updated_at before update on public.orders
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_routes_updated_at on public.routes;
create trigger update_routes_updated_at before update on public.routes
  for each row execute function public.update_updated_at_column();

-- Create function to handle new user signup
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

-- Create trigger for new user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();`,
}

export default function SetupPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [copiedScript, setCopiedScript] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const hasRlsError = searchParams?.get("error") === "rls_recursion"

  useEffect(() => {
    if (hasRlsError) {
      setMessage("Infinite Recursion Error Detected. Please re-run Script 2 to fix this issue.")
      setStatus("error")
    }
  }, [hasRlsError])

  const testConnection = async () => {
    setStatus("loading")
    setMessage("")

    try {
      const response = await fetch("/api/setup-database", {
        method: "POST",
      })

      const data = await response.json()

      if (data.tablesExist) {
        setStatus("success")
        setMessage(data.message)
      } else {
        setStatus("error")
        setMessage(data.message)
      }
    } catch (error: any) {
      setStatus("error")
      setMessage("Failed to connect to database")
    }
  }

  const copyToClipboard = async (scriptName: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedScript(scriptName)
    setTimeout(() => setCopiedScript(null), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-12">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Database className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-3xl">Database Setup Required</CardTitle>
            <CardDescription className="text-base">
              Run these SQL scripts in your Supabase SQL Editor to initialize the database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {hasRlsError && (
              <Alert className="border-red-200 bg-red-50">
                <XCircle className="h-5 w-5 text-red-600" />
                <AlertDescription className="text-red-800 ml-2">
                  <p className="font-semibold mb-2">Infinite Recursion Error Detected</p>
                  <p className="text-sm">
                    Your database has an older version of the RLS policies that causes infinite recursion. Please re-run{" "}
                    <strong>Script 2 (Security)</strong> below to fix this issue.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Instructions */}
            <Alert>
              <AlertDescription>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>
                    Open your{" "}
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      Supabase Dashboard
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Navigate to SQL Editor in the left sidebar</li>
                  <li>Copy and run each script below in order (1, 2, then 3)</li>
                  {hasRlsError && (
                    <li className="text-red-600 font-semibold">
                      If you already ran the scripts, re-run Script 2 to fix the recursion error
                    </li>
                  )}
                  <li>Click "Test Connection" below to verify setup</li>
                </ol>
              </AlertDescription>
            </Alert>

            {/* SQL Scripts */}
            <Tabs defaultValue="001_create_tables.sql" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="001_create_tables.sql">1. Tables</TabsTrigger>
                <TabsTrigger value="002_enable_rls.sql">2. Security</TabsTrigger>
                <TabsTrigger value="003_create_profile_trigger.sql">3. Triggers</TabsTrigger>
              </TabsList>
              {Object.entries(SQL_SCRIPTS).map(([name, content]) => (
                <TabsContent key={name} value={name} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{name}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(name, content)}
                      className="gap-2"
                    >
                      {copiedScript === name ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy SQL
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto text-xs max-h-96 overflow-y-auto">
                    {content}
                  </pre>
                </TabsContent>
              ))}
            </Tabs>

            {/* Test Connection */}
            <div className="space-y-3">
              <Button onClick={testConnection} className="w-full" size="lg" disabled={status === "loading"}>
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>

              {status === "success" && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <AlertDescription className="text-green-800 ml-2">
                    <p className="font-semibold mb-2">{message}</p>
                    <div className="mt-3 space-x-2">
                      <Button asChild size="sm">
                        <a href="/auth/sign-up">Create Account</a>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <a href="/auth/login">Login</a>
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {status === "error" && (
                <Alert className="border-amber-200 bg-amber-50">
                  <XCircle className="h-5 w-5 text-amber-600" />
                  <AlertDescription className="text-amber-800 ml-2">
                    <p className="font-semibold">{message}</p>
                    <p className="text-sm mt-1">Please run the SQL scripts above in your Supabase SQL Editor.</p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
