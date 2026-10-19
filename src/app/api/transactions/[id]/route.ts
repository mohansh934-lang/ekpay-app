import { api, json } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { getUpiSdk } from "../../../../server/upi/sdk";
import { ApiError } from "../../../../server/errors";
import { one } from "../../../../server/db";

/** Transaction detail + live status (pending ho to settle check bhi chalta hai) + is par chal rahi complaint. */
export const GET = api(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = requireUser(req);
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(400, "INVALID_INPUT", "id invalid hai");
  const transaction = await getUpiSdk().getTransactionStatus(user.id, id);
  const complaint = one<{ ticket: string; status: string }>(
    "SELECT ticket, status FROM complaints WHERE txn_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1", id, user.id
  );
  return json({ success: true, transaction, complaint: complaint ?? null });
});
