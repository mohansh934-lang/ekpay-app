import { api, json, readJson } from "../../../../server/http";
import { register, sessionCookie } from "../../../../server/auth";

export const POST = api(async (req) => {
  const { token, user } = await register(req, await readJson(req));
  return json({ success: true, user }, { status: 201, headers: { "Set-Cookie": sessionCookie(token) } });
});
