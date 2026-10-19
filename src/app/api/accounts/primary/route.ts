import { api, json, posInt, readJson } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { setPrimary } from "../../../../server/linking";

export const POST = api(async (req) => {
  const user = requireUser(req);
  const b = await readJson(req);
  return json({ success: true, ...setPrimary(user.id, posInt(b.bankAccountId, "bankAccountId")) });
});
