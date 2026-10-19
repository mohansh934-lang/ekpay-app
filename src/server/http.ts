import { ApiError } from "./errors";

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
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
  const len = Number(req.headers.get("content-length"));
  if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body bahut badi hai");
  }
  let raw: string;
  try { raw = await req.text(); } catch { throw new ApiError(400, "INVALID_JSON", "Body read nahi ho payi"); }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body bahut badi hai");
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new ApiError(400, "INVALID_JSON", "Body valid JSON nahi hai"); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "INVALID_BODY", "Body JSON object hona chahiye");
  }
  return body as Record<string, unknown>;
}

export function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) {
      const k = part.slice(0, i).trim();
      const v = part.slice(i + 1).trim();
      try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
    }
  }
  return out;
}

export function clientIp(req: Request): string {
  // In production, only trust X-Forwarded-For when explicitly behind a trusted reverse proxy (TRUST_PROXY=true).
  // In test/dev mode, allow headers so unit tests can simulate distinct client IPs.
  const trustProxy = process.env.TRUST_PROXY === "true" || process.env.NODE_ENV !== "production";
  if (trustProxy) {
    return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
  }
  return "direct-client";
}

// ---- Input validators (chhote, dependency-free) ----
export function str(v: unknown, field: string, min = 1, max = 120): string {
  if (typeof v !== "string") throw new ApiError(400, "INVALID_INPUT", `${field} string hona chahiye`);
  const s = v.trim();
  if (s.length < min || s.length > max) {
    throw new ApiError(400, "INVALID_INPUT", `${field} ${min}–${max} characters ka hona chahiye`);
  }
  return s;
}

export function optStr(v: unknown, field: string, max = 120): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return str(v, field, 1, max);
}

export function posInt(v: unknown, field: string, max = 1_000_000): number {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN;
  if (!Number.isSafeInteger(n) || n < 1 || n > max) {
    throw new ApiError(400, "INVALID_INPUT", `${field} 1–${max} ke beech integer hona chahiye`);
  }
  return n;
}

const IDEM_RE = /^[A-Za-z0-9._\-]{8,64}$/;
export function idemKey(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || !IDEM_RE.test(v)) {
    throw new ApiError(400, "INVALID_IDEMPOTENCY_KEY", "idempotencyKey 8–64 chars (A-Z, 0-9, . _ -) hona chahiye");
  }
  return v;
}

// ---- Simple in-memory rate limiter (sliding window) ----
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (b.count >= max) {
    const retryAfterSec = Math.ceil((b.resetAt - now) / 1000);
    throw new ApiError(429, "RATE_LIMITED", "Bahut zyada requests, thodi der baad try karo", { retryAfterSec });
  }
  b.count++;
}

export const _resetRateLimits = () => buckets.clear();
