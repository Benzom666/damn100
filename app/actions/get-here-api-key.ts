"use server"

/**
 * Returns the HERE Maps API key securely from the server.
 * Uses server-side HERE_API_KEY environment variable only.
 * This prevents exposing the API key to the client.
 */
export async function getHereApiKey(): Promise<string> {
  const apiKey = process.env.HERE_API_KEY || ""

  if (!apiKey) {
    console.error("[v0] [HERE_KEY] HERE_API_KEY not configured")
    throw new Error("HERE Maps API key is not configured")
  }

  console.log("[v0] [HERE_KEY] API key loaded successfully")
  return apiKey
}
