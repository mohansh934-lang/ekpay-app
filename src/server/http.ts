import { ApiError } from "./errors";

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function json(data: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return Response.json(data, { status: init.status ?? 200, headers: { ...BASE_HEADERS, ...init.headers } });
}

/** Har route ise wrap karta hai: CSRF check + error -> JSON mapping. */
export function api<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        const headers: Record<string, string> = {};
        const retry = e.extra.retryAfterSec;
        if (typeof retry === "number") headers["Retry-After"] = String(retry);
        return json(
          { success: false, error: { code: e.code, message: e.message, ...e.extra } },
          { status: e.status, headers }
        );
      }
      console.error("[api] unexpected error:", e);
      return json({ success: false, error: { code: "INTERNAL", message: "Server error" } }, { status: 500 });
    }
  };
}

/**
 * CSRF: cookie SameSite=Lax hai, upar se state-changing requests me Origin same-site hona chahiye.
 * Non-browser clients (curl, tests) Origin bhejte hi nahi, unhe allow hai (unke paas cookie auto-attach nahi hoti).
 */
function assertSameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (origin) {
    const host = req.headers.get("host") ?? new URL(req.url).host;
    let originHost = "";
    try { originHost = new URL(origin).host; } catch { /* invalid */ }
    if (originHost !== host) throw new ApiError(403, "CSRF_BLOCKED", "Cross-site request allowed nahi hai");
  } else if (site && site !== "same-origin" && site !== "none") {
    throw new ApiError(403, "CSRF_BLOCKED", "Cross-site request allowed nahi hai");
  }
}

const MAX_BODY_BYTES = 16 * 1024;

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type application/json hona chahiye");
  }
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request bahut badi hai");
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request bahut badi hai");
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new ApiError(400, "INVALID_JSON", "Body valid JSON nahi hai"); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "INVALID_BODY", "Body JSON object hona chahiye");
  }
  return body as Record<string, unknown>;
}

export function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

// ---- Input validators (chhote, dependency-free) ----
export function str(v: unknown, field: string, min: number, max: number): string {
  if (typeof v !== "string") throw new ApiError(400, "INVALID_INPUT", `${field} string hona chahiye`);
  const s = v.trim();
  if (s.length < min || s.length > max) {
    throw new ApiError(400, "INVALID_INPUT", `${field} ${min}-${max} characters ka hona chahiye`);
  }
  // control characters allowed nahi
  if (/[\u0000-\u001f\u007f]/.test(s)) throw new ApiError(400, "INVALID_INPUT", `${field} me invalid characters hain`);
  return s;
}
export const optStr = (v: unknown, field: string, max: number) =>
  v === undefined || v === null || v === "" ? undefined : str(v, field, 1, max);

export function posInt(v: unknown, field: string, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > max) {
    throw new ApiError(400, "INVALID_INPUT", `${field} valid positive integer hona chahiye`);
  }
  return v;
}

export function idemKey(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) {
    throw new ApiError(400, "INVALID_INPUT", "idempotencyKey 8-64 chars (A-Z a-z 0-9 _ -) ka hona chahiye");
  }
  return v;
}

// ---- Simple in-memory rate limiter (per-process; multi-server pe Redis chahiye) ----
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return;
  }
  if (++b.count > limit) {
    throw new ApiError(429, "RATE_LIMITED", "Bahut zyada requests, thodi der baad try karo", {
      retryAfterSec: Math.ceil((b.reset - now) / 1000),
    });
  }
}
