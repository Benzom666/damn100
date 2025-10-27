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
