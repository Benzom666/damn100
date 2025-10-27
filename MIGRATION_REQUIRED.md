# ⚠️ Database Migration Required

The application now supports customer email for POD notifications, but the database schema needs to be updated.

## Run Migration Script

Execute the following SQL script in your Supabase SQL Editor or via the v0 scripts runner:

**File:** `scripts/011_require_customer_email.sql`

\`\`\`sql
-- Add customer_email column to orders table
alter table public.orders
  add column if not exists customer_email text;

-- Clean up any empty strings
update public.orders set customer_email = null where customer_email = '';

-- Make customer_email required
alter table public.orders
  alter column customer_email set not null;

-- Add email format validation constraint
alter table public.orders
  add constraint valid_email
  check (customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add index for email lookups
create index if not exists idx_orders_customer_email on public.orders(customer_email);
\`\`\`

## What This Does

1. Adds `customer_email` column to the `orders` table
2. Makes it a required field (NOT NULL)
3. Adds email format validation
4. Creates an index for faster email lookups

## After Migration

Once the migration is complete:
- All new orders will require a customer email
- POD notifications will be sent to customers automatically
- CSV imports must include the `customer_email` column

## Current Status

The application is currently running in **backward compatibility mode**:
- ✅ Works without the migration (customer_email is optional)
- ⚠️ POD email notifications are disabled until migration is run
- ⚠️ CSV imports don't require customer_email yet

After running the migration, the app will enforce email requirements and enable POD notifications.
