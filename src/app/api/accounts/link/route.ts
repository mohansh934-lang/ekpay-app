import { api, json, rateLimit, readJson, str } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { getUpiSdk } from "../../../../server/upi/sdk";

export const POST = api(async (req) => {
  const user = requireUser(req);
  rateLimit(`link:${user.id}`, 20, 60 * 60 * 1000);
  const b = await readJson(req);
  const account = await getUpiSdk().linkAccount(user, str(b.bankId, "bankId", 1, 80), b.last4 as string);
  return json({ success: true, account }, { status: 201 });
});
