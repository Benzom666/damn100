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
