import { config } from "./config";
import { ApiError } from "./errors";
import { one, transaction } from "./db";

/**
 * Brute-force guard (login password + UPI PIN).
 * Attempt PEHLE reserve hota hai, verify BAAD me. Isse 100 parallel guesses bhi
 * sirf `maxAttempts` hi verify tak pahunchte hain (race condition band).
 */
export type AttemptKind = "login" | "pin";
const COLS = {
  login: { f: "login_failures", l: "login_locked_until" },
  pin: { f: "pin_failures", l: "pin_locked_until" },
} as const;

const locked = (ms: number) =>
  new ApiError(423, "LOCKED", `Bahut zyada galat attempts. ${Math.ceil(ms / 60000)} minute baad try karo`, {
    retryAfterSec: Math.ceil(ms / 1000),
  });

export function reserveAttempt(userId: number, kind: AttemptKind) {
  const c = COLS[kind];
  transaction((db) => {
    const r = db.prepare(`SELECT ${c.f} AS f, ${c.l} AS l FROM users WHERE id = ?`).get(userId) as
      | { f: number; l: number }
      | undefined;
    if (!r) throw new ApiError(401, "UNAUTHORIZED", "Login zaroori hai");
    const now = Date.now();
    if (r.l > now) throw locked(r.l - now);
    if (r.f >= config.maxAttempts) {
      db.prepare(`UPDATE users SET ${c.l} = ?, ${c.f} = 0 WHERE id = ?`).run(now + config.lockMs, userId);
      throw locked(config.lockMs);
    }
    db.prepare(`UPDATE users SET ${c.f} = ${c.f} + 1 WHERE id = ?`).run(userId);
  });
}

export function clearAttempts(userId: number, kind: AttemptKind) {
  const c = COLS[kind];
  transaction((db) => db.prepare(`UPDATE users SET ${c.f} = 0, ${c.l} = 0 WHERE id = ?`).run(userId));
}

/** Galat verify ke baad call karo. Remaining attempts return karta hai (0 = ab lock). */
export function registerFailure(userId: number, kind: AttemptKind): number {
  const c = COLS[kind];
  return transaction((db) => {
    const r = db.prepare(`SELECT ${c.f} AS f FROM users WHERE id = ?`).get(userId) as { f: number };
    if (r.f >= config.maxAttempts) {
      db.prepare(`UPDATE users SET ${c.l} = ?, ${c.f} = 0 WHERE id = ?`).run(Date.now() + config.lockMs, userId);
      return 0;
    }
    return config.maxAttempts - r.f;
  });
}

export const _peek = (userId: number, kind: AttemptKind) =>
  one<{ f: number; l: number }>(`SELECT ${COLS[kind].f} AS f, ${COLS[kind].l} AS l FROM users WHERE id = ?`, userId);
