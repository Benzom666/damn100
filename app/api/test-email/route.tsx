import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const searchParams = request.searchParams
  const testEmail = searchParams.get("to")

  if (!testEmail) {
    return NextResponse.json({ error: "Missing ?to=email@example.com parameter" }, { status: 400 })
  }

  console.log("[v0] [TEST_EMAIL] Testing email to:", testEmail)

  // Check environment variables
  const apiKey = process.env.SENDGRID_API_KEY || process.env.SEND_GRID_API_KEY
  const fromEmail = process.env.DELIVERY_FROM_EMAIL

  console.log("[v0] [TEST_EMAIL] API key exists:", !!apiKey)
  console.log("[v0] [TEST_EMAIL] API key starts with SG.:", apiKey?.startsWith("SG."))
  console.log("[v0] [TEST_EMAIL] From email:", fromEmail)

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "SENDGRID_API_KEY not configured",
        help: "Add SENDGRID_API_KEY to environment variables",
      },
      { status: 500 },
    )
  }

  if (!fromEmail) {
    return NextResponse.json(
      {
        error: "DELIVERY_FROM_EMAIL not configured",
        help: "Add DELIVERY_FROM_EMAIL to environment variables",
      },
      { status: 500 },
    )
  }

  try {
    // Send test email using SendGrid API
    const emailData = {
      personalizations: [
        {
          to: [{ email: testEmail }],
          subject: "Test Email - Delivery System",
        },
      ],
      from: { email: fromEmail },
      content: [
        {
          type: "text/html",
          value: `
            <h2>Test Email Successful!</h2>
            <p>If you're reading this, your SendGrid integration is working correctly.</p>
            <p><strong>Configuration:</strong></p>
            <ul>
              <li>From: ${fromEmail}</li>
              <li>To: ${testEmail}</li>
              <li>Sent at: ${new Date().toISOString()}</li>
            </ul>
            <p>Next steps:</p>
            <ol>
              <li>Check if this email went to spam</li>
              <li>If in spam, verify your sender domain in SendGrid</li>
              <li>Set up domain authentication for better deliverability</li>
            </ol>
          `,
        },
      ],
    }

    console.log("[v0] [TEST_EMAIL] Sending to SendGrid...")

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailData),
    })

    const responseText = await response.text()
    console.log("[v0] [TEST_EMAIL] SendGrid status:", response.status)
    console.log("[v0] [TEST_EMAIL] SendGrid response:", responseText)

    // Get message ID from headers
    const messageId = response.headers.get("x-message-id")
    console.log("[v0] [TEST_EMAIL] Message ID:", messageId)

    if (response.ok || response.status === 202) {
      return NextResponse.json({
        success: true,
        status: response.status,
        message: "Test email sent successfully!",
        messageId: messageId,
        to: testEmail,
        from: fromEmail,
        instructions: [
          "1. Check your inbox (and spam folder)",
          "2. If email is in spam, verify your sender domain in SendGrid",
          "3. Track this email in SendGrid dashboard using the message ID above",
          "4. Go to: https://app.sendgrid.com/email_activity",
        ],
      })
    } else {
      return NextResponse.json(
        {
          error: "SendGrid API error",
          status: response.status,
          details: responseText,
          troubleshooting: {
            400: "Bad request - check sender email is verified",
            401: "Invalid API key - check SENDGRID_API_KEY",
            403: "Forbidden - sender email not verified or account suspended",
            429: "Rate limit exceeded - wait and try again",
          },
        },
        { status: response.status },
      )
    }
  } catch (error) {
    console.error("[v0] [TEST_EMAIL] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to send test email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
