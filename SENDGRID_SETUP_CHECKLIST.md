# SendGrid POD Email Setup Checklist

## Environment Variables

Ensure these are set in both **Preview** and **Production** environments:

### Required Variables
- `SENDGRID_API_KEY` - Your SendGrid API key (starts with `SG.`)
- `DELIVERY_FROM_EMAIL` - Verified sender email (e.g., `noreply@yourdomain.com`)
- `NEXT_PUBLIC_ENABLE_POD_EMAIL` - Set to `"true"` to enable POD emails

## SendGrid Dashboard Checklist

### 1. API Key Configuration
- Go to **Settings → API Keys** in SendGrid dashboard
- Ensure your API key has **Mail Send** permission
- Copy the full API key (starts with `SG.`)

### 2. Sender Verification
- Go to **Settings → Sender Authentication**
- Verify your sender email address or domain
- The email in `DELIVERY_FROM_EMAIL` must match a verified sender

### 3. Check Suppressions
- Go to **Suppressions** in SendGrid dashboard
- Remove your test email addresses if they're listed in:
  - Bounces
  - Blocks
  - Spam Reports
  - Invalid Emails

### 4. Review Activity
- Go to **Activity** to see email delivery logs
- Check for any failed deliveries and their reasons

## Testing Steps

### 1. Test the Email Endpoint
Visit: `/api/test-mail?to=your@email.com`

Expected response:
\`\`\`json
{
  "ok": true,
  "status": 202,
  "message": "Test email sent"
}
\`\`\`

### 2. Test POD Email Flow
1. Log in as a driver
2. Navigate to an assigned route
3. Mark a delivery as complete with POD
4. Check server logs for:
   \`\`\`
   [MAIL][POD] SendGrid response: { ok: true, status: 202, ... }
   \`\`\`

### 3. Check Email Delivery
- Check the customer's inbox (and spam folder)
- Email should contain:
  - Order number
  - Delivery timestamp
  - Delivery address
  - Links to photo and signature (if provided)
  - Delivery notes (if provided)

## Troubleshooting

### Status 400: Bad Request
- Check that `DELIVERY_FROM_EMAIL` is verified in SendGrid
- Ensure email addresses are valid format

### Status 401: Unauthorized
- Verify `SENDGRID_API_KEY` is correct and starts with `SG.`
- Check that API key has Mail Send permission

### Status 403: Forbidden
- Check if sender email is verified
- Review SendGrid account status

### Status 429: Too Many Requests
- You've hit SendGrid's rate limit
- Wait a few minutes and try again

### Email Not Received
- Check spam/junk folder
- Verify email isn't in SendGrid suppressions
- Check SendGrid Activity feed for delivery status

## Diagnostic Logs

When POD email is triggered, you should see these logs:

\`\`\`
[v0] [POD] Triggering email via API route
[v0] [POD] Order ID: <uuid>
[v0] [POD] POD ID: <uuid>
[MAIL] Sending email via SendGrid HTTPS API
[MAIL] To: customer@example.com
[MAIL] From: noreply@yourdomain.com
[MAIL] Subject: Proof of Delivery – #12345
[MAIL] Response status: 202
[MAIL] Response ok: true
[MAIL][POD] SendGrid response: { ok: true, status: 202, ... }
[v0] [POD] Email API response: { ok: true, status: 202, ... }
\`\`\`

## Database Verification

Check that emails are being logged:

\`\`\`sql
SELECT * FROM pod_emails ORDER BY created_at DESC LIMIT 10;
\`\`\`

Each successful email should have:
- `pod_id` - Links to the POD record
- `order_id` - Links to the order
- `to_email` - Customer email address
- `provider_message_id` - SendGrid message ID
- `created_at` - Timestamp of email send

## Production Deployment

Before deploying to production:

1. ✅ All environment variables set in Vercel
2. ✅ Sender email/domain verified in SendGrid
3. ✅ Test email endpoint works
4. ✅ POD email flow tested in preview
5. ✅ Database migration `010_pod_emails_idempotency.sql` executed
6. ✅ Database migration `011_require_customer_email.sql` executed
7. ✅ All test emails received successfully

## Support

If issues persist:
- Check SendGrid Activity feed for detailed delivery logs
- Review server logs for `[MAIL]` and `[POD]` prefixed messages
- Verify all environment variables are set correctly
- Ensure database migrations have been run
