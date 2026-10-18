import { api, json, readJson } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { createSip } from "../../../server/wealth";

export const POST = api(async (req) => {
  const result = createSip(requireUser(req).id, await readJson(req));
  return json({ success: true, ...result }, { status: result.replayed ? 200 : 201 });
});
