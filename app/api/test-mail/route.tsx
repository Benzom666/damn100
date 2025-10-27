export const runtime = "edge"

import { NextResponse } from "next/server"
import { sendSendgridMail } from "@/lib/mail/sendgrid-http"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const to = url.searchParams.get("to")
  const apiKey = process.env.SENDGRID_API_KEY || ""
  const from = process.env.DELIVERY_FROM_EMAIL || ""

  console.log("[MAIL][TEST] Testing SendGrid HTTPS integration")
  console.log("[MAIL][TEST] To:", to)
  console.log("[MAIL][TEST] From:", from)
  console.log("[MAIL][TEST] API Key present:", !!apiKey)

  if (!to) {
    return NextResponse.json({ ok: false, error: "Provide ?to=email@example.com" }, { status: 400 })
  }
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "SENDGRID_API_KEY missing" }, { status: 500 })
  }
  if (!from) {
    return NextResponse.json({ ok: false, error: "DELIVERY_FROM_EMAIL missing" }, { status: 500 })
  }

  const resp = await sendSendgridMail({
    apiKey,
    from,
    to,
    subject: "✅ Twilio SendGrid HTTPS test",
    html: `<p>If you see this, SDK was removed and HTTPS works.</p><p>${new Date().toISOString()}</p>`,
  })

  console.log("[MAIL][TEST] Result:", resp)
  return NextResponse.json(resp, { status: resp.ok ? 200 : 500 })
}
