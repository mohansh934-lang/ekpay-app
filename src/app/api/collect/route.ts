import { api, json, readJson } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { createCollect, listCollect } from "../../../server/collect";

export const GET = api(async (req) => json({ success: true, ...listCollect(requireUser(req).id) }));

export const POST = api(async (req) => {
  const user = requireUser(req);
  return json({ success: true, request: createCollect(user.id, await readJson(req)) }, { status: 201 });
});
