import { api, json, readJson } from "../../../../server/http";
import { login, sessionCookie } from "../../../../server/auth";

export const POST = api(async (req) => {
  const { token, user } = await login(req, await readJson(req));
  return json({ success: true, user }, { headers: { "Set-Cookie": sessionCookie(token) } });
});
