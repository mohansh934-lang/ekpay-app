import { api, json, readJson } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { resolveCollect } from "../../../../server/collect";
import { ApiError } from "../../../../server/errors";

/** body: { action: "approve" | "decline" | "cancel", pin? (approve par zaroori), bankAccountId? } */
export const POST = api(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = requireUser(req);
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(400, "INVALID_INPUT", "id invalid hai");
  return json({ success: true, request: await resolveCollect(user.id, id, await readJson(req)) });
});
