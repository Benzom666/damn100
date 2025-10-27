interface TokenCache {
  token: string
  expiresAt: number
}

let cachedToken: TokenCache | null = null

export async function getHereAccessToken(): Promise<string | null> {
  // Check if OAuth is enabled
  const authMode = process.env.HERE_TOUR_PLANNING_AUTH || "apikey"
  if (authMode !== "oauth") return null

  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt - 60000 > now) {
    return cachedToken.token
  }

  // Use provided HERE OAuth credentials
  const tokenUrl = process.env.HERE_OAUTH_TOKEN_URL || "https://account.api.here.com/oauth2/token"
  const accessKeyId = process.env.HERE_ACCESS_KEY_ID!
  const accessKeySecret = process.env.HERE_ACCESS_KEY_SECRET!

  if (!accessKeyId || !accessKeySecret) {
    throw new Error("HERE OAuth credentials not configured")
  }

  const basic = Buffer.from(`${accessKeyId}:${accessKeySecret}`).toString("base64")

  console.log("[v0] Requesting HERE OAuth token...")

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HERE OAuth token error ${response.status}: ${errorText}`)
  }

  const { access_token, expires_in } = await response.json()

  cachedToken = {
    token: access_token,
    expiresAt: now + (expires_in || 3600) * 1000,
  }

  console.log("[v0] HERE OAuth token obtained successfully")

  return access_token
}
