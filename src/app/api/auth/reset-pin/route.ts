import { api, json, readJson } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { resetPin } from "../../../../server/pin";

/** Forgot UPI PIN (simulator): account password + naya PIN. */
export const POST = api(async (req) => {
  const user = requireUser(req);
  await resetPin(user.id, await readJson(req));
  return json({ success: true });
});
