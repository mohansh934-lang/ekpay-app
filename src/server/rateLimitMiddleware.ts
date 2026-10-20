import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, type RateLimitConfig } from "./rateLimit";

/**
 * API route ke andar rate limit check karo.
 * Agar limit exceed ho gayi toh 429 response return karta hai, warna null.
 */
export function rateLimitCheck(
  req: Request,
  config: RateLimitConfig = { windowMs: 60_000, maxRequests: 30 },
  prefix = "api"
): NextResponse | null {
  const ip = getClientIp(req);
  const key = `${prefix}:${ip}`;
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Bahut zyada requests — thoda ruko aur try karo" } },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((result.retryAfterMs || 60000) / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null; // allowed — proceed
}

