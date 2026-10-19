import { api, json } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { unlinkAccount } from "../../../../server/linking";
import { ApiError } from "../../../../server/errors";

/** Bank account unlink (soft delete). */
export const DELETE = api(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = requireUser(req);
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(400, "INVALID_INPUT", "id invalid hai");
  return json({ success: true, ...unlinkAccount(user.id, id) });
});
