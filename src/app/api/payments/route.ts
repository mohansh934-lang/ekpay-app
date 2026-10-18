import { api, json, readJson } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { pay } from "../../../server/payments";

export const POST = api(async (req) => {
  const user = requireUser(req);
  const result = await pay(user.id, await readJson(req));
  return json({ success: true, ...result }, { status: result.replayed ? 200 : 201 });
});
