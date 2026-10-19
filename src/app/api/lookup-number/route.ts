import { api, json, rateLimit } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { ApiError } from "../../../server/errors";

/**
 * Mobile number validate + operator (Numverify). Key sirf env se: PHONE_LOOKUP_API_KEY.
 * Pehle yahan key hardcoded thi aur API fail hone par "valid: true, Jio" jhooth bola jaata tha, ab nahi.
 */
export const GET = api(async (req) => {
  const user = requireUser(req);
  rateLimit(`lookup:${user.id}`, 30, 60 * 60 * 1000);

  const key = process.env.PHONE_LOOKUP_API_KEY;
  if (!key) throw new ApiError(503, "NOT_CONFIGURED", "Number lookup abhi configured nahi hai (PHONE_LOOKUP_API_KEY)");

  const digits = (new URL(req.url).searchParams.get("phone") || "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (!/^[6-9]\d{9}$/.test(last10)) throw new ApiError(400, "INVALID_PHONE", "Valid 10-digit Indian mobile number daalo");

  let data: { valid?: boolean; carrier?: string; location?: string; country_name?: string } | null = null;
  try {
    const res = await fetch(`https://api.apilayer.com/numverify/validate?number=${encodeURIComponent("+91" + last10)}`, {
      headers: { apikey: key }, cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (res.ok) data = await res.json();
  } catch { /* neeche 502 */ }
  if (!data) throw new ApiError(502, "UPSTREAM_ERROR", "Number lookup service abhi available nahi hai");

  const carrier = (data.carrier || "").toLowerCase();
  const operator =
    carrier.includes("airtel") ? "Airtel"
    : /vodafone|idea|\bvi\b/.test(carrier) ? "Vi"
    : /bsnl|mtnl/.test(carrier) ? "BSNL"
    : /jio|reliance/.test(carrier) ? "Jio"
    : null; // pehchaan nahi hui to andaza nahi lagate
  return json({
    success: true, valid: !!data.valid, operator, carrier: data.carrier || null,
    location: data.location || null, country: data.country_name || null,
  });
});
