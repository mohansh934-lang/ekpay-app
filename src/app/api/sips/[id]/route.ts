import { api, json } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { deleteSip } from "../../../../server/wealth";
import { ApiError } from "../../../../server/errors";

export const DELETE = api(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = requireUser(req);
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(400, "INVALID_INPUT", "id invalid hai");
  deleteSip(user.id, id);
  return json({ success: true });
});
