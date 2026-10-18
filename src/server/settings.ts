import { config } from "./config";
import { ApiError } from "./errors";
import { one, transaction } from "./db";
import { rupees, toPaise } from "./money";

export type Theme = "light" | "dark" | "system";
const THEMES: readonly string[] = ["light", "dark", "system"];

export interface Prefs {
  theme: Theme;
  soundOn: boolean;
  hideBalance: boolean;
  intlUpi: boolean;
  payAlerts: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  theme: "light", soundOn: true, hideBalance: false, intlUpi: false, payAlerts: true,
};

interface Row {
  theme: Theme; sound_on: number; hide_balance: number; intl_upi: number; pay_alerts: number;
}

/** Purane users ke paas row nahi hoti: unhe defaults milte hain (koi backfill migration nahi chahiye). */
export function getPrefs(userId: number): Prefs {
  const r = one<Row>(
    `SELECT theme, sound_on, hide_balance, intl_upi, pay_alerts FROM user_settings WHERE user_id = ?`, userId
  );
  if (!r) return { ...DEFAULT_PREFS };
  return {
    theme: r.theme, soundOn: !!r.sound_on, hideBalance: !!r.hide_balance, intlUpi: !!r.intl_upi,
    payAlerts: !!r.pay_alerts,
  };
}

const bool = (v: unknown, field: string): 0 | 1 => {
  if (typeof v !== "boolean") throw new ApiError(400, "INVALID_INPUT", `${field} true ya false hona chahiye`);
  return v ? 1 : 0;
};

/** Sirf bheje gaye fields validate hote hain (partial update). Column names fixed whitelist se aate hain. */
function parsePrefs(b: Record<string, unknown>) {
  const sets: { col: string; val: string | number | null }[] = [];
  if (b.theme !== undefined) {
    if (typeof b.theme !== "string" || !THEMES.includes(b.theme)) {
      throw new ApiError(400, "INVALID_INPUT", "theme 'light', 'dark' ya 'system' hona chahiye");
    }
    sets.push({ col: "theme", val: b.theme });
  }
  if (b.soundOn !== undefined) sets.push({ col: "sound_on", val: bool(b.soundOn, "soundOn") });
  if (b.hideBalance !== undefined) sets.push({ col: "hide_balance", val: bool(b.hideBalance, "hideBalance") });
  if (b.intlUpi !== undefined) sets.push({ col: "intl_upi", val: bool(b.intlUpi, "intlUpi") });
  if (b.payAlerts !== undefined) sets.push({ col: "pay_alerts", val: bool(b.payAlerts, "payAlerts") });
  return { sets };
}

/**
 * PATCH /api/settings: budget aur/ya preferences, sab ek hi transaction me
 * (ek field galat ho to koi bhi change save nahi hota).
 */
export function updateSettings(userId: number, b: Record<string, unknown>) {
  const { sets } = parsePrefs(b);
  const budgetPaise = b.budget === undefined
    ? undefined
    : toPaise(b.budget, { min: 100_00, max: config.maxBudgetPaise, field: "budget" });
  if (!sets.length && budgetPaise === undefined) {
    throw new ApiError(400, "INVALID_INPUT", "Badalne ke liye koi setting nahi bheji");
  }

  transaction((db) => {
    if (budgetPaise !== undefined) {
      db.prepare("UPDATE wallets SET budget_paise = ? WHERE user_id = ?").run(budgetPaise, userId);
    }
    if (!sets.length) return;

    const cols = sets.map((s) => s.col);
    const vals = sets.map((s) => s.val);
    db.prepare("INSERT OR IGNORE INTO user_settings (user_id, updated_at) VALUES (?, ?)").run(userId, Date.now());
    db.prepare(`UPDATE user_settings SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = ? WHERE user_id = ?`)
      .run(...vals, Date.now(), userId);
  });
  return readSettings(userId);
}

export function readSettings(userId: number) {
  const w = one<{ b: number }>("SELECT budget_paise AS b FROM wallets WHERE user_id = ?", userId);
  return { budget: rupees(w?.b ?? 0), settings: getPrefs(userId) };
}
