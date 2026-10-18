import { api, json } from "../../../../server/http";
import { clearedCookie, destroySession } from "../../../../server/auth";

export const POST = api(async (req) => {
  destroySession(req);
  return json({ success: true }, { headers: { "Set-Cookie": clearedCookie() } });
});
