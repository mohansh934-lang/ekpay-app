import { api, json } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { getUpiSdk } from "../../../server/upi/sdk";

/** UPI par live banks (ListAccountProvider). `?q=` se search. Popular pehle. */
export const GET = api(async (req) => {
  requireUser(req);
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 50) || undefined;
  const banks = await getUpiSdk().getBankList(q);
  return json({ success: true, count: banks.length, banks });
});
