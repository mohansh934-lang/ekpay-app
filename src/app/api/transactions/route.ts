import { api, json } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { listTxns } from "../../../server/ledger";
import { ApiError } from "../../../server/errors";
import { settlePending } from "../../../server/settle";

export const GET = api(async (req) => {
  const user = requireUser(req);
  const sp = new URL(req.url).searchParams;
  const limit = Number(sp.get("limit") ?? 20);
  const before = sp.get("before") ? Number(sp.get("before")) : undefined;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new ApiError(400, "INVALID_INPUT", "limit 1-50 hona chahiye");
  if (before !== undefined && (!Number.isInteger(before) || before < 1)) throw new ApiError(400, "INVALID_INPUT", "before invalid hai");
  const category = sp.get("category")?.slice(0, 30) || undefined;
  const q = sp.get("q")?.trim().slice(0, 50) || undefined;
  const st = sp.get("status");
  if (st !== null && st !== "success" && st !== "pending" && st !== "failed") throw new ApiError(400, "INVALID_INPUT", "status success, pending ya failed hona chahiye");
  settlePending(user.id);
  return json({ success: true, ...listTxns(user.id, { limit, before, category, q, status: st ?? undefined }) });
});
