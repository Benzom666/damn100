# Checkpoint 2 - Validation Checklist

## Overview
This document tracks the validation of all three critical fixes implemented for the delivery management application.

## Environment Variables Required

Add these to your Vercel project environment variables:

\`\`\`bash
# Feature Flags
NEXT_PUBLIC_ENABLE_DISPATCH_MAP=true
NEXT_PUBLIC_ENABLE_POD_EMAIL=true

# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
DELIVERY_FROM_EMAIL=noreply@yourdomain.com
\`\`\`

## Database Migration Required

Run this SQL script in your Supabase SQL editor:

\`\`\`sql
-- Execute scripts/007_create_driver_positions.sql
-- This creates the driver_positions table, indexes, RLS policies, and upsert function
\`\`\`

## Validation Checklist

### 1. Admin Panel - Routes Management

- [ ] Log in as admin user
- [ ] Navigate to Admin > Routes
- [ ] Create a new route
  - [ ] Route details page loads instantly (no "Loading route details..." hang)
  - [ ] Route information displays correctly
- [ ] Edit an existing route
  - [ ] Edit dialog opens with current data
  - [ ] Changes save successfully
  - [ ] UI refreshes automatically
- [ ] Delete a route
  - [ ] Confirmation dialog appears
  - [ ] Route is removed from list
  - [ ] Page revalidates automatically
- [ ] Assign route to driver
  - [ ] Driver receives route assignment
  - [ ] Route appears in driver's app immediately

**Expected Behavior:**
- All route operations complete without errors
- No "Loading route details..." infinite loading
- Proper error messages if operations fail
- Automatic UI refresh after mutations

### 2. Dispatch Monitor - Live Driver Tracking

- [ ] Log in as admin user
- [ ] Navigate to Admin > Dispatch
- [ ] Verify map displays
  - [ ] Map shows all active routes
  - [ ] Order markers appear (blue=pending, green=delivered, red=failed)
  - [ ] Driver markers appear (purple with 🚗 icon)
  - [ ] Route polylines connect stops in sequence
- [ ] Check driver location updates
  - [ ] Each driver shows "last updated X mins ago"
  - [ ] Positions update every 30 seconds
- [ ] Toggle map visibility
  - [ ] "Hide Map" button works
  - [ ] Map can be shown again
- [ ] Verify with NEXT_PUBLIC_ENABLE_DISPATCH_MAP=false
  - [ ] Map section is hidden
  - [ ] Route cards still display

**Expected Behavior:**
- Map renders all drivers and routes simultaneously
- Auto-refresh every 30 seconds
- Smooth performance with multiple routes
- Graceful degradation if geolocation unavailable

### 3. Driver App - Geolocation Tracking

- [ ] Log in as driver user
- [ ] Open an assigned route
- [ ] Check browser console for geolocation logs
  - [ ] "[v0] Driver position updated: lat, lng" appears
  - [ ] Updates occur every ~30 seconds
- [ ] Verify in Supabase
  - [ ] Check `driver_positions` table
  - [ ] Driver's position is being updated
  - [ ] `updated_at` timestamp is recent
- [ ] Check Admin > Dispatch
  - [ ] Driver's marker appears on map
  - [ ] Position matches driver's actual location

**Expected Behavior:**
- Geolocation permission requested on route open
- Position updates every 30 seconds
- Updates continue while route is active
- No errors if geolocation denied (graceful fallback)

### 4. POD Submission with Email

- [ ] Log in as driver user
- [ ] Navigate to a stop
- [ ] Submit POD with:
  - [ ] Photo captured
  - [ ] Signature drawn
  - [ ] Recipient name entered
  - [ ] Notes added
- [ ] Mark as "Delivered"
- [ ] Verify POD saved
  - [ ] Success message appears
  - [ ] Redirected to route overview
  - [ ] Stop shows green checkmark
- [ ] Check SendGrid activity log
  - [ ] Email sent to customer
  - [ ] Email contains photo, signature, recipient name, notes
  - [ ] Email formatted correctly (HTML)
- [ ] Test email failure scenario
  - [ ] Set SENDGRID_API_KEY to invalid value
  - [ ] Submit POD
  - [ ] POD still saves successfully
  - [ ] Driver sees success message
  - [ ] Console shows email error (non-blocking)

**Expected Behavior:**
- POD submission always succeeds
- Email sending is non-blocking
- Email failure doesn't prevent POD save
- Customer receives professional HTML email with attachments

### 5. RLS Policies Verification

Run these queries in Supabase SQL editor as different users:

**As Admin:**
\`\`\`sql
-- Should return all routes
SELECT * FROM routes;

-- Should return all driver positions
SELECT * FROM driver_positions;

-- Should be able to update any route
UPDATE routes SET status = 'active' WHERE id = 'some-route-id';
\`\`\`

**As Driver:**
\`\`\`sql
-- Should return only assigned routes
SELECT * FROM routes WHERE driver_id = auth.uid();

-- Should return only own position
SELECT * FROM driver_positions WHERE driver_id = auth.uid();

-- Should be able to update own position
SELECT upsert_driver_position(auth.uid(), 40.7128, -74.0060, 10.0);
\`\`\`

**Expected Behavior:**
- Admins have full access to all data
- Drivers can only see/update their own data
- RLS policies enforce data isolation
- No unauthorized access errors

### 6. Production Environment Testing

- [ ] Deploy to Vercel production
- [ ] Verify environment variables are set
- [ ] Test admin panel in production
  - [ ] Routes load correctly
  - [ ] Edit/delete work
- [ ] Test dispatch map in production
  - [ ] Map renders
  - [ ] Driver positions display
- [ ] Test driver app in production
  - [ ] Geolocation works
  - [ ] POD submission works
  - [ ] Email sends successfully
- [ ] Check Vercel logs for errors
- [ ] Check Supabase logs for RLS violations

**Expected Behavior:**
- All features work identically in production
- No CORS errors
- No authentication loops
- Proper error handling and logging

## Common Issues and Solutions

### Issue: Route details page shows "Loading route details..." forever

**Solution:** This was caused by synchronous `params` access in Next.js 15+. Fixed by awaiting params:
\`\`\`typescript
const { id } = await params
\`\`\`

### Issue: Dispatch map doesn't show driver positions

**Solution:** 
1. Ensure `scripts/007_create_driver_positions.sql` has been executed
2. Verify `NEXT_PUBLIC_ENABLE_DISPATCH_MAP=true` is set
3. Check driver app is updating positions (console logs)
4. Verify RLS policies allow admin to read `driver_positions`

### Issue: POD email not sending

**Solution:**
1. Verify `SENDGRID_API_KEY` is set correctly
2. Verify `NEXT_PUBLIC_ENABLE_POD_EMAIL=true` is set
3. Check SendGrid API key has "Mail Send" permission
4. Verify `customer_email` field exists in orders table
5. Check Vercel function logs for SendGrid errors

### Issue: Geolocation not working

**Solution:**
1. Ensure HTTPS is enabled (required for geolocation)
2. Check browser permissions for location access
3. Verify `navigator.geolocation` is available
4. Check console for geolocation errors
5. Test on mobile device (better GPS accuracy)

## Sign-off

Once all checklist items pass:

- [ ] All admin features work in preview
- [ ] All admin features work in production
- [ ] All driver features work in preview
- [ ] All driver features work in production
- [ ] No console errors
- [ ] No Supabase RLS violations
- [ ] Email notifications working
- [ ] Geolocation tracking working

**Checkpoint 2 Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

**Signed off by:** _________________  
**Date:** _________________

---

## Rollback Plan

If critical issues are found:

1. Revert to Checkpoint 1 (v1) in v0 interface
2. Identify specific failing component
3. Fix in isolation
4. Re-test before re-deploying

**Checkpoint 1 (Stable):** v1 - Basic functionality without live tracking or email
**Checkpoint 2 (Current):** v4 - Full feature set with tracking and notifications
