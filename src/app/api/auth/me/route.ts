import { api, json } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";

export const GET = api(async (req) => json({ success: true, user: requireUser(req) }));
