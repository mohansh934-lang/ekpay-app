import { api, json, readJson } from "../../../../server/http";
import { requireUser, changePin } from "../../../../server/auth";

export const POST = api(async (req) => {
  await changePin(requireUser(req).id, await readJson(req));
  return json({ success: true });
});
