import { api, json, rateLimit, readJson, str } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { getUpiSdk } from "../../../../server/upi/sdk";

/** ListAccount: select ki hui bank me is mobile number se linked accounts (masked). */
export const POST = api(async (req) => {
  const user = requireUser(req);
  rateLimit(`discover:${user.id}`, 40, 60 * 60 * 1000);
  const b = await readJson(req);
  const accounts = await getUpiSdk().discoverAccounts(user, str(b.bankId, "bankId", 1, 80));
  return json({ success: true, accounts });
});
