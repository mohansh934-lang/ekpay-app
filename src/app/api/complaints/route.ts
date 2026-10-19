import { api, json, readJson } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { createComplaint, listComplaints, COMPLAINT_CATEGORIES } from "../../../server/complaints";

export const GET = api(async (req) =>
  json({ success: true, categories: COMPLAINT_CATEGORIES, complaints: listComplaints(requireUser(req).id) }));

export const POST = api(async (req) => {
  const user = requireUser(req);
  return json({ success: true, complaint: createComplaint(user.id, await readJson(req)) }, { status: 201 });
});
