# Customer Email Requirement - Verification Guide

## Overview
Every order now requires a valid customer email address for POD (Proof of Delivery) notifications via SendGrid.

---

## Implementation Summary

### 1. Database Changes ✓
**File:** `scripts/011_require_customer_email.sql`

\`\`\`sql
-- Add customer_email column
alter table public.orders add column if not exists customer_email text;

-- Clean up empty strings
update public.orders set customer_email = null where customer_email = '';

-- Make it required
alter table public.orders alter column customer_email set not null;

-- Add email validation constraint
alter table public.orders
  add constraint valid_email
  check (customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
\`\`\`

**Verification:**
\`\`\`sql
-- Check column exists and is NOT NULL
\d orders

-- Test constraint
insert into orders (customer_name, address, customer_email) 
values ('Test', '123 Main', 'invalid-email');
-- Expected: ERROR - violates check constraint "valid_email"

insert into orders (customer_name, address, customer_email) 
values ('Test', '123 Main', 'valid@example.com');
-- Expected: SUCCESS
\`\`\`

---

### 2. Frontend Form Updates ✓
**File:** `app/admin/orders/order-dialog.tsx`

**Changes:**
- Added required "Customer Email" input field with red asterisk
- Added `type="email"` for browser validation
- Added helper text: "Required for POD email notifications"
- Field is marked as `required` to prevent form submission without it

**Verification:**
1. Open Admin > Orders
2. Click "Create Order"
3. Try to submit without email → Browser blocks submission
4. Enter invalid email (e.g., "notanemail") → Browser shows error
5. Enter valid email → Form submits successfully

---

### 3. CSV Import Validation ✓
**File:** `app/admin/orders/csv-import-dialog.tsx`

**Changes:**
- Updated description to require `customer_email` column
- Updated example CSV to include `customer_email`

**File:** `app/admin/orders/actions.ts` (importOrdersFromCSV)

**Changes:**
- Check if CSV headers include `customer_email` column
- Validate each row has a non-empty `customer_email`
- Validate email format using regex
- Return detailed errors for invalid rows
- Block import if any validation errors exist

**Verification:**

**Test 1: Missing customer_email column**
\`\`\`csv
customer_name,address,city,state,zip
John Doe,123 Main St,Springfield,IL,62701
\`\`\`
Expected: Error "CSV must include 'customer_email' column to enable POD notifications"

**Test 2: Missing email in row**
\`\`\`csv
customer_name,address,city,state,zip,customer_email
John Doe,123 Main St,Springfield,IL,62701,
\`\`\`
Expected: Error "Row 2: Missing customer_email (required for POD notifications)"

**Test 3: Invalid email format**
\`\`\`csv
customer_name,address,city,state,zip,customer_email
John Doe,123 Main St,Springfield,IL,62701,notanemail
\`\`\`
Expected: Error "Row 2: Invalid customer_email format: notanemail"

**Test 4: Valid CSV**
\`\`\`csv
customer_name,address,city,state,zip,phone,notes,customer_email
John Doe,123 Main St,Springfield,IL,62701,555-0100,Leave at door,john@example.com
Jane Smith,456 Oak Ave,Chicago,IL,60601,555-0200,Ring bell,jane@example.com
\`\`\`
Expected: Success "Successfully imported 2 order(s)"

---

### 4. Server Validation ✓
**File:** `app/admin/orders/actions.ts`

**Changes:**
- Added `isValidEmail()` helper function
- Validate email presence and format in `createOrder()`
- Validate email presence and format in `updateOrder()`
- Validate email in CSV import before geocoding
- Throw descriptive errors for missing/invalid emails

**Verification:**
\`\`\`typescript
// Test validation function
isValidEmail("test@example.com") // true
isValidEmail("invalid") // false
isValidEmail("") // false
isValidEmail("test@") // false
\`\`\`

---

### 5. POD Email Integration ✓
**File:** `app/driver/actions.tsx` (afterPodSaved)

**Changes:**
- Already uses `order.customer_email` field
- Checks if email exists before sending
- Logs warning if email is missing
- Non-blocking: POD saves even if email fails

**Verification:**
1. Create order with valid email
2. Assign to route
3. Driver delivers order and submits POD
4. Check logs for:
   \`\`\`
   [MAIL] Sending POD email to: customer@example.com
   [MAIL] queued OK for customer@example.com
   \`\`\`
5. Check customer inbox for POD email
6. Check SendGrid dashboard for delivery status

---

### 6. UI/UX Feedback ✓

**Manual Order Creation:**
- Red asterisk (*) indicates required field
- Browser validation prevents submission without email
- Browser validation checks email format
- Helper text explains why email is needed

**CSV Import:**
- Clear error messages for missing column
- Row-by-row validation with specific error messages
- Errors displayed in alert box with list
- Import blocked if any errors exist

**Order Display:**
- Customer email visible in order details
- Email shown in orders table (if applicable)

---

### 7. TypeScript Types ✓
**File:** `lib/types.ts`

**Changes:**
- Updated `Order` interface to include `customer_email: string`
- Field is non-nullable (required)

---

## Verification Test Plan

### Test 1: Manual Order Creation
1. Navigate to Admin > Orders
2. Click "Create Order"
3. Fill in customer name and address
4. Leave email blank → Try to submit
   - **Expected:** Browser blocks submission with "Please fill out this field"
5. Enter "notanemail" → Try to submit
   - **Expected:** Browser shows "Please include an '@' in the email address"
6. Enter "test@example.com" → Submit
   - **Expected:** Order created successfully

### Test 2: CSV Import - Missing Column
1. Navigate to Admin > Orders
2. Click "Import CSV"
3. Paste CSV without customer_email column
4. Click "Import Orders"
   - **Expected:** Error alert "CSV must include 'customer_email' column to enable POD notifications"

### Test 3: CSV Import - Invalid Emails
1. Paste CSV with invalid emails:
   \`\`\`csv
   customer_name,address,customer_email
   John Doe,123 Main,notanemail
   Jane Smith,456 Oak,
   \`\`\`
2. Click "Import Orders"
   - **Expected:** Error list showing:
     - "Row 2: Invalid customer_email format: notanemail"
     - "Row 3: Missing customer_email (required for POD notifications)"

### Test 4: CSV Import - Valid Data
1. Paste valid CSV:
   \`\`\`csv
   customer_name,address,city,state,zip,customer_email
   John Doe,123 Main St,Springfield,IL,62701,john@example.com
   \`\`\`
2. Click "Import Orders"
   - **Expected:** Success "Successfully imported 1 order(s)"

### Test 5: End-to-End POD Email
1. Create order with email: test@yourdomain.com
2. Assign order to route
3. Assign route to driver
4. Driver app: Mark order as delivered with POD
5. Check logs for:
   \`\`\`
   [MAIL] Sending POD email to: test@yourdomain.com
   [MAIL] queued OK for test@yourdomain.com
   \`\`\`
6. Check email inbox for POD notification
7. Verify email contains:
   - Order number
   - Delivery address
   - Delivery timestamp
   - Links to photo and signature (if provided)

### Test 6: Database Constraint
\`\`\`sql
-- Try to insert order without email
insert into orders (customer_name, address) 
values ('Test Customer', '123 Main St');
-- Expected: ERROR - null value in column "customer_email" violates not-null constraint

-- Try to insert order with invalid email
insert into orders (customer_name, address, customer_email) 
values ('Test Customer', '123 Main St', 'invalid');
-- Expected: ERROR - new row violates check constraint "valid_email"

-- Insert order with valid email
insert into orders (customer_name, address, customer_email) 
values ('Test Customer', '123 Main St', 'test@example.com');
-- Expected: SUCCESS
\`\`\`

---

## Rollback Plan

If issues arise, rollback in reverse order:

1. **Remove NOT NULL constraint:**
   \`\`\`sql
   alter table orders alter column customer_email drop not null;
   \`\`\`

2. **Remove validation constraint:**
   \`\`\`sql
   alter table orders drop constraint if exists valid_email;
   \`\`\`

3. **Revert form changes:**
   - Remove `required` attribute from email input
   - Remove email validation from actions

4. **Revert CSV import:**
   - Remove email column requirement check
   - Remove email validation in import function

---

## Environment Variables

Ensure these are set for POD email to work:

\`\`\`bash
NEXT_PUBLIC_ENABLE_POD_EMAIL=true
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
DELIVERY_FROM_EMAIL=noreply@yourdomain.com
\`\`\`

---

## Success Criteria

- ✅ Database constraint prevents orders without valid email
- ✅ Manual order form requires email with browser validation
- ✅ CSV import validates email column and format
- ✅ Server actions validate email before insert/update
- ✅ POD email uses customer_email field
- ✅ Clear error messages guide users to fix issues
- ✅ TypeScript types updated to reflect required field
- ✅ End-to-end test: Create order → Deliver → Email received

---

## Logs to Monitor

**Successful POD Email:**
\`\`\`
[MAIL] Sending POD email to: customer@example.com
[MAIL] queued OK for customer@example.com
\`\`\`

**Missing Email (should not happen after migration):**
\`\`\`
[MAIL] order fetch fail - customer_email is null
\`\`\`

**SendGrid Error:**
\`\`\`
[MAIL] send failed: 401 Unauthorized
\`\`\`

**Feature Flag Disabled:**
\`\`\`
[MAIL] POD email disabled via feature flag
\`\`\`

---

## Next Steps

1. Run migration script `011_require_customer_email.sql` in production
2. Update any existing orders with placeholder emails if needed
3. Test manual order creation
4. Test CSV import with sample data
5. Test end-to-end POD email flow
6. Monitor SendGrid dashboard for delivery rates
7. Collect feedback from users on email notifications
