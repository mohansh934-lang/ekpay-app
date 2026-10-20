/**
 * In-memory sliding-window rate limiter
 * Har IP ke liye configurable limit (window ke andar kitni requests allowed)
 */

interface RateEntry {
  timestamps: number[];
}

const store = new Map<string, RateEntry>();

// Har 5 min me purani entries clean karo (memory leak prevention)
if (typeof globalThis !== "undefined") {
  const key = "__ek_rl_cleanup";
  if (!(globalThis as any)[key]) {
    (globalThis as any)[key] = true;
    setInterval(() => {
      const now = Date.now();
      for (const [k, entry] of store) {
        entry.timestamps = entry.timestamps.filter(t => now - t < 300_000);
        if (entry.timestamps.length === 0) store.delete(k);
      }
    }, 300_000);
  }
}

export interface RateLimitConfig {
  windowMs: number;   // time window in milliseconds
  maxRequests: number; // max requests in that window
}

/**
 * Check rate limit for a given key (usually IP address).
 * Returns { allowed: true } ya { allowed: false, retryAfterMs }
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = { windowMs: 60_000, maxRequests: 30 }
): { allowed: boolean; retryAfterMs?: number; remaining: number } {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Purane timestamps hatao (window ke bahar wale)
  entry.timestamps = entry.timestamps.filter(t => now - t < config.windowMs);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = config.windowMs - (now - oldest);
    return { allowed: false, retryAfterMs, remaining: 0 };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: config.maxRequests - entry.timestamps.length };
}

/**
 * Extract client IP from Next.js request (proxy-safe)
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "127.0.0.1";
}

