import { api, json } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { getState } from "../../../server/state";

// Sirf GET. Pehle yahan koi bhi POST karke balance badal sakta tha, ab sab changes
// specific, validated endpoints se hote hain (/api/payments, /api/trades, ...).
export const GET = api(async (req) => json({ success: true, ...getState(requireUser(req)) }));
