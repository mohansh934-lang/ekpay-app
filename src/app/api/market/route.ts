import { api, json } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { listQuotes } from "../../../server/market";

export const GET = api(async (req) => {
  requireUser(req);
  return json({ success: true, quotes: listQuotes() });
});
