/**
 * Centralized environment variable access with validation
 * SERVER-ONLY - Do not import this file in client components
 * Throws clear errors on missing required keys
 */

function getEnvVar(key: string, required = true): string | undefined {
  const value = process.env[key]
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export const env = {
  // HERE Maps (server-side only)
  HERE_API_KEY: getEnvVar("HERE_API_KEY", false) || getEnvVar("HERE_SERVER_API_KEY", false),
  HERE_TOUR_PLANNING_AUTH: getEnvVar("HERE_TOUR_PLANNING_AUTH", false) || "apikey",

  // Supabase (server-side)
  SUPABASE_URL: getEnvVar("SUPABASE_URL"),
  SUPABASE_ANON_KEY: getEnvVar("SUPABASE_ANON_KEY"),

  // Vercel Blob
  BLOB_READ_WRITE_TOKEN: getEnvVar("BLOB_READ_WRITE_TOKEN", false),

  // App Config
  NODE_ENV: getEnvVar("NODE_ENV", false) || "development",
  LOG_LEVEL: getEnvVar("LOG_LEVEL", false) || "info",

  // Route Optimization
  ROUTE_CAPACITY: Number(getEnvVar("ROUTE_CAPACITY", false) || "9999"),
  MAX_DEPOT_DISTANCE_KM: Number(getEnvVar("MAX_DEPOT_DISTANCE_KM", false) || "80"),
} as const

// Validate critical keys on startup
if (!env.HERE_API_KEY) {
  console.warn("[env] No HERE API key found - route optimization will fail")
}

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  throw new Error("[env] Supabase configuration is incomplete")
}

console.log("[env] Environment validated successfully")
console.log(`[env] NODE_ENV: ${env.NODE_ENV}`)
console.log(`[env] HERE auth mode: ${env.HERE_TOUR_PLANNING_AUTH}`)
