import { api, json, readJson } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { setBudget } from "../../../server/wealth";

export const PATCH = api(async (req) => {
  const budget = setBudget(requireUser(req).id, await readJson(req));
  return json({ success: true, budget });
});
