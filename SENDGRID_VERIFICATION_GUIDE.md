# SendGrid Integration Verification Guide

## Overview

The SendGrid integration is now complete with:
- ✅ Node.js runtime configuration
- ✅ Centralized mailer utility (`lib/mail/sendgrid.ts`)
- ✅ Test endpoint (`/api/test-mail`)
- ✅ POD email automation with idempotency
- ✅ Proper error handling and logging

---

## Step 1: Verify Environment Variables

Make sure these are set in the **Vars** section of the in-chat sidebar:

\`\`\`bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
DELIVERY_FROM_EMAIL=noreply@yourdomain.com
NEXT_PUBLIC_ENABLE_POD_EMAIL=true
\`\`\`

**Important:** The `DELIVERY_FROM_EMAIL` must be a verified sender in your SendGrid account.

---

## Step 2: Test SendGrid Connection

### Option A: Using the Test Endpoint

Visit this URL in your browser (replace with your actual domain and email):

\`\`\`
https://your-app.vercel.app/api/test-mail?to=your@email.com
\`\`\`

**Expected Response:**
\`\`\`json
{
  "ok": true,
  "status": 202,
  "message": "Email sent successfully"
}
\`\`\`

**Expected Logs:**
\`\`\`
[MAIL] Sending test email to: your@email.com
[MAIL] From: noreply@yourdomain.com
[MAIL] ✓ Email sent successfully
[MAIL] Status code: 202
\`\`\`

### Option B: Check Your Email

Within 1-2 minutes, you should receive an email with:
- Subject: "✅ Twilio SendGrid live test"
- Body: "If you see this, your SendGrid + Node.js integration works."
- Timestamp of when it was sent

---

## Step 3: Test POD Email Flow

### 3.1 Submit a POD

1. Log in as a driver
2. Navigate to an active route
3. Complete a delivery with:
   - Photo (optional)
   - Signature (optional)
   - Recipient name (optional)
   - Notes (optional)
4. Submit the POD

### 3.2 Verify Email Sent

**Expected Logs:**
\`\`\`
[MAIL] POD email disabled via feature flag  // If flag is false
// OR
[MAIL] Sending POD email to: customer@example.com
[MAIL] SendGrid initialized
[MAIL] status: 202
[MAIL] queued OK for customer@example.com
\`\`\`

### 3.3 Check Database

Run this query to verify the email was logged:

\`\`\`sql
SELECT 
  pe.pod_id,
  pe.order_id,
  pe.to_email,
  pe.sent_at,
  pe.provider_message_id,
  o.order_number,
  o.customer_name
FROM pod_emails pe
JOIN orders o ON o.id = pe.order_id
ORDER BY pe.sent_at DESC
LIMIT 5;
\`\`\`

**Expected Result:**
- One row per POD email sent
- `sent_at` timestamp should be recent
- `provider_message_id` should be "accepted"

### 3.4 Verify Idempotency

Try to trigger the same POD email again (by reloading the page or resubmitting). You should see:

\`\`\`
[MAIL] already sent for pod: <pod-id>
\`\`\`

This confirms the idempotency check is working and prevents duplicate emails.

---

## Step 4: Verify Email Content

The customer should receive an email with:

**Subject:**
\`\`\`
Proof of Delivery – Order #12345
\`\`\`

**Body:**
\`\`\`
Delivery complete

Order: #12345
Delivered at: 2025-01-15T14:30:00.000Z
Address: 123 Main St, New York, NY 10001
Notes: Left at front door
[View delivery photo]
[View signature]
\`\`\`

---

## Troubleshooting

### Error: "Missing ?to param"

**Cause:** You didn't provide the `to` query parameter.

**Fix:** Add `?to=your@email.com` to the URL.

---

### Error: "DELIVERY_FROM_EMAIL not configured"

**Cause:** The `DELIVERY_FROM_EMAIL` environment variable is not set.

**Fix:** Add it in the **Vars** section with a verified sender email.

---

### Error: "Sender email not verified"

**Cause:** The sender email is not verified in SendGrid.

**Fix:**
1. Go to SendGrid Dashboard → Settings → Sender Authentication
2. Verify your sender email or domain
3. Wait for verification email and click the link

---

### Error: "Invalid API key"

**Cause:** The `SENDGRID_API_KEY` is incorrect or expired.

**Fix:**
1. Go to SendGrid Dashboard → Settings → API Keys
2. Create a new API key with "Mail Send" permissions
3. Copy the key and update the environment variable
4. Redeploy the app

---

### Error: "Cannot find module 'fs'"

**Cause:** The API route is running in Edge runtime instead of Node.js runtime.

**Fix:** Ensure the route has `export const runtime = "nodejs"` at the top.

---

### Email Not Received

**Possible Causes:**
1. Email is in spam folder
2. Sender email not verified
3. SendGrid account suspended or limited
4. Email address is invalid

**Debug Steps:**
1. Check SendGrid Activity Feed: https://app.sendgrid.com/email_activity
2. Search for the recipient email address
3. Check the delivery status and any error messages
4. Verify the sender email is verified

---

## Feature Flags

### Disable POD Emails

Set this environment variable to disable POD emails:

\`\`\`bash
NEXT_PUBLIC_ENABLE_POD_EMAIL=false
\`\`\`

This will skip email sending but still save the POD successfully.

### Re-enable POD Emails

Set it back to `true` and redeploy:

\`\`\`bash
NEXT_PUBLIC_ENABLE_POD_EMAIL=true
\`\`\`

---

## Monitoring

### Check Logs

In Vercel Dashboard:
1. Go to your project
2. Click "Logs" tab
3. Filter by `[MAIL]` to see all email-related logs

### Check SendGrid Dashboard

1. Go to https://app.sendgrid.com
2. Click "Activity" in the left sidebar
3. View email delivery status, opens, clicks, etc.

---

## Summary

✅ **Test endpoint works:** `/api/test-mail?to=your@email.com` returns 202

✅ **POD emails send:** After POD submission, customer receives email

✅ **Idempotency works:** Duplicate emails are prevented

✅ **Logs are clear:** All operations logged with `[MAIL]` prefix

✅ **Feature flag works:** Can enable/disable without code changes

✅ **Error handling:** Failures are logged but don't block POD submission

---

## Next Steps

1. Test the `/api/test-mail` endpoint first
2. Verify you receive the test email
3. Submit a test POD and verify the customer receives the email
4. Check the database to confirm the email was logged
5. Monitor the logs for any errors

If everything works, the SendGrid integration is production-ready! 🚀
