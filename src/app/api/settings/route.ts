import { api, json, readJson } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { readSettings, updateSettings } from "../../../server/settings";

export const GET = api(async (req) => json({ success: true, ...readSettings(requireUser(req).id) }));

/** Body (sab optional, kam se kam ek): budget, theme, soundOn, hideBalance, intlUpi, payAlerts */
export const PATCH = api(async (req) => {
  const result = updateSettings(requireUser(req).id, await readJson(req));
  return json({ success: true, ...result });
});
