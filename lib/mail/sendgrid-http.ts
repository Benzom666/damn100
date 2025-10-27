// Works in Edge & Node – no "fs" or SDK dependencies

export async function sendSendgridMail({
  apiKey,
  from,
  to,
  subject,
  html,
  text,
}: {
  apiKey: string
  from: string
  to: string
  subject: string
  html?: string
  text?: string
}) {
  console.log("[MAIL] Sending email via SendGrid HTTPS API")
  console.log("[MAIL] To:", to)
  console.log("[MAIL] From:", from)
  console.log("[MAIL] Subject:", subject)

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [
        ...(text ? [{ type: "text/plain", value: text }] : []),
        ...(html ? [{ type: "text/html", value: html }] : []),
      ],
      mail_settings: {
        click_tracking: { enable: false, enable_text: false },
        open_tracking: { enable: false },
      },
    }),
    cache: "no-store",
  })

  const ok = res.status === 202

  let body: any = null
  try {
    body = await res.json()
  } catch {
    try {
      body = await res.text()
    } catch {
      body = null
    }
  }

  const headers = Object.fromEntries(res.headers.entries())

  console.log("[MAIL] Response status:", res.status)
  console.log("[MAIL] Response ok:", ok)
  if (!ok) {
    console.error("[MAIL] Error body:", body)
  }

  return { ok, status: res.status, body, headers }
}
