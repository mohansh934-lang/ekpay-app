import { api, json, rateLimit } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { ApiError } from "../../../server/errors";

// Valid 2-digit Indian mobile series prefixes for offline heuristic only
const AIRTEL_PREFIXES = new Set(["98", "99", "97", "96", "89", "88", "87", "70"]);
const VI_PREFIXES = new Set(["95", "92", "91", "83", "76"]);
const BSNL_PREFIXES = new Set(["94", "93", "86", "85", "84", "75"]);

function detectByPrefix(tenDigitPhone: string): "Jio" | "Airtel" | "Vi" | "BSNL" {
  const prefix2 = tenDigitPhone.slice(0, 2); // Fixed: 2-digit slice instead of 3-digit
  if (AIRTEL_PREFIXES.has(prefix2)) return "Airtel";
  if (VI_PREFIXES.has(prefix2)) return "Vi";
  if (BSNL_PREFIXES.has(prefix2)) return "BSNL";
  return "Jio";
}

export const GET = api(async (req) => {
  const user = requireUser(req);
  rateLimit(`lookup:${user.id}`, 20, 60 * 1000); // Max 20 lookups/min per logged-in user

  const { searchParams } = new URL(req.url);
  const rawPhone = (searchParams.get("phone") || "").replace(/\D/g, "");
  const tenDigit = rawPhone.slice(-10);

  if (!/^[6-9]\d{9}$/.test(tenDigit)) {
    throw new ApiError(400, "INVALID_PHONE", "Valid 10-digit Indian mobile number required");
  }

  const apiKey = process.env.PHONE_LOOKUP_API_KEY;
  if (!apiKey) {
    const op = detectByPrefix(tenDigit);
    return json({
      success: true,
      verified: false,
      source: "offline-prefix-heuristic",
      operator: op,
      carrier: `${op} (Estimated by prefix — PHONE_LOOKUP_API_KEY not configured)`,
      location: "India",
    });
  }

  try {
    const formattedPhone = "+91" + tenDigit;
    const response = await fetch(
      `https://api.apilayer.com/numverify/validate?number=${encodeURIComponent(formattedPhone)}`,
      {
        headers: { apikey: apiKey },
        cache: "no-store",
      }
    );

    const data = (await response.json()) as Record<string, unknown>;

    if (response.ok && data && data.valid === true) {
      const carrierStr = String(data.carrier || "").toLowerCase();
      let detectedOp: "Jio" | "Airtel" | "Vi" | "BSNL" = "Jio";
      if (carrierStr.includes("airtel")) detectedOp = "Airtel";
      else if (carrierStr.includes("vodafone") || carrierStr.includes("idea") || carrierStr.includes("vi")) detectedOp = "Vi";
      else if (carrierStr.includes("bsnl") || carrierStr.includes("mtnl")) detectedOp = "BSNL";
      else if (carrierStr.includes("jio") || carrierStr.includes("reliance")) detectedOp = "Jio";

      return json({
        success: true,
        verified: true,
        source: "numverify-live",
        operator: detectedOp,
        carrier: String(data.carrier || detectedOp),
        location: String(data.location || "India"),
      });
    }

    const op = detectByPrefix(tenDigit);
    return json({
      success: true,
      verified: false,
      source: "offline-prefix-heuristic",
      operator: op,
      carrier: `${op} (Estimated by prefix)`,
      location: "India",
    });
  } catch {
    const op = detectByPrefix(tenDigit);
    return json({
      success: true,
      verified: false,
      source: "offline-prefix-heuristic",
      operator: op,
      carrier: `${op} (Estimated — Lookup service unreachable)`,
      location: "India",
    });
  }
});
