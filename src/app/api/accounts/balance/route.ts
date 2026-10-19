import { api, json, posInt, readJson } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { getUpiSdk } from "../../../../server/upi/sdk";

/** Balance check (PIN ke saath, jaise real UPI me). */
export const POST = api(async (req) => {
  const user = requireUser(req);
  const b = await readJson(req);
  const id = b.bankAccountId === undefined ? undefined : posInt(b.bankAccountId, "bankAccountId");
  return json({ success: true, ...(await getUpiSdk().checkBalance(user.id, id, b.pin)) });
});
