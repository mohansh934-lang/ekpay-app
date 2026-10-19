import { config } from "./config";
import { ApiError } from "./errors";
import { many, one, transaction } from "./db";
import { sha256 } from "./security";
import { getBank } from "./banks";
import { getAccount } from "./ledger";
import { verifyPin } from "./auth";
import { rupees } from "./money";
import type { SessionUser } from "./auth";

export interface DiscoveredAccount { last4: string; type: "Savings" | "Current"; maskedNumber: string; ifsc: string }

/**
 * MOCK ListAccount API: user ke mobile number + bank se deterministic accounts banata hai.
 * Real me ye NPCI -> bank se aata hai (upi/sdk.ts ka RealUpiSdkService). Client apna last4 nahi bana sakta,
 * link karte waqt hum yahi list dobara bana kar match karte hain.
 */
export function mockDiscover(phone: string, bankId: string): DiscoveredAccount[] {
  const bank = getBank(bankId);
  if (!bank) throw new ApiError(404, "BANK_NOT_FOUND", "Ye bank list me nahi hai");
  const h = sha256(`${phone}:${bankId}`);
  const n = (i: number) => String(parseInt(h.slice(i, i + 6), 16) % 10000).padStart(4, "0");
  const code = bank.name.replace(/[^A-Za-z]/g, "").toUpperCase().padEnd(4, "X").slice(0, 4);
  const ifsc = `${code}0${String(parseInt(h.slice(20, 26), 16) % 1_000_000).padStart(6, "0")}`;
  const out: DiscoveredAccount[] = [{ last4: n(0), type: "Savings", maskedNumber: `XXXXXX${n(0)}`, ifsc }];
  if (parseInt(h[30], 16) % 3 === 0) {
    const l2 = n(8) === n(0) ? "0001" : n(8);
    out.push({ last4: l2, type: "Current", maskedNumber: `XXXXXX${l2}`, ifsc });
  }
  return out;
}

/** Mock opening balance (sirf simulator). Real me bank se balance PIN ke saath fetch hota hai. */
const mockBalancePaise = (phone: string, bankId: string, last4: string) =>
  (parseInt(sha256(`${phone}:${bankId}:${last4}:bal`).slice(0, 6), 16) % 49_000 + 1_000) * 100;

export function mockLink(user: SessionUser, bankId: string, last4: unknown) {
  if (typeof last4 !== "string" || !/^\d{4}$/.test(last4)) throw new ApiError(400, "INVALID_INPUT", "last4 4 digits ka hona chahiye");
  const bank = getBank(bankId);
  if (!bank) throw new ApiError(404, "BANK_NOT_FOUND", "Ye bank list me nahi hai");
  const found = mockDiscover(user.phone, bankId).find((a) => a.last4 === last4);
  if (!found) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Is mobile number se is bank me ye account linked nahi mila");

  return transaction((db) => {
    const existing = db
      .prepare("SELECT id, active FROM bank_accounts WHERE user_id = ? AND bank_name = ? AND last4 = ?")
      .get(user.id, bank.name, last4) as { id: number; active: number } | undefined;
    if (existing?.active === 1) throw new ApiError(409, "ALREADY_LINKED", "Ye account pehle se linked hai");

    const activeCount = Number((db.prepare("SELECT COUNT(*) AS c FROM bank_accounts WHERE user_id = ? AND active = 1").get(user.id) as { c: number }).c);
    if (activeCount >= config.maxLinkedAccounts) {
      throw new ApiError(409, "TOO_MANY_ACCOUNTS", `Max ${config.maxLinkedAccounts} accounts hi link ho sakte hain`);
    }
    const hasPrimary = activeCount > 0 && !!db.prepare("SELECT 1 FROM bank_accounts WHERE user_id = ? AND active = 1 AND is_primary = 1").get(user.id);

    let id: number;
    if (existing) {
      // Pehle unlink kiya tha: wahi account wapas (balance bhi wahi, paisa mint nahi hota).
      db.prepare("UPDATE bank_accounts SET active = 1, is_primary = ? WHERE id = ?").run(hasPrimary ? 0 : 1, existing.id);
      id = existing.id;
    } else {
      const res = db
        .prepare("INSERT INTO bank_accounts (user_id, bank_name, last4, balance_paise, is_primary, created_at, ifsc) VALUES (?,?,?,?,?,?,?)")
        .run(user.id, bank.name, last4, mockBalancePaise(user.phone, bankId, last4), hasPrimary ? 0 : 1, Date.now(), found.ifsc);
      id = Number(res.lastInsertRowid);
    }
    return { id, label: `${bank.name} ••${last4}`, isPrimary: !hasPrimary };
  });
}

/** Unlink: soft delete. Aakhri active account unlink nahi hota. Primary hata to koi aur primary ban jaata hai. */
export function unlinkAccount(userId: number, accountId: number) {
  return transaction((db) => {
    const acc = db.prepare("SELECT id, is_primary FROM bank_accounts WHERE id = ? AND user_id = ? AND active = 1").get(accountId, userId) as
      | { id: number; is_primary: number } | undefined;
    if (!acc) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Bank account nahi mila");
    const left = db.prepare("SELECT id FROM bank_accounts WHERE user_id = ? AND active = 1 AND id != ? ORDER BY id").all(userId, accountId) as { id: number }[];
    if (!left.length) throw new ApiError(409, "LAST_ACCOUNT", "Aakhri bank account unlink nahi ho sakta");
    db.prepare("UPDATE bank_accounts SET active = 0, is_primary = 0 WHERE id = ?").run(accountId);
    if (acc.is_primary) db.prepare("UPDATE bank_accounts SET is_primary = 1 WHERE id = ?").run(left[0].id);
    return { removed: accountId, newPrimaryId: acc.is_primary ? left[0].id : null };
  });
}

export function setPrimary(userId: number, accountId: number) {
  transaction((db) => {
    getAccount(db, userId, accountId); // ownership + active check
    db.prepare("UPDATE bank_accounts SET is_primary = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE user_id = ? AND active = 1").run(accountId, userId);
  });
  return { primaryId: accountId };
}

/** Balance check: real UPI me bhi PIN lagta hai. Yahan simulator PIN verify (lockout rules ke saath). */
export async function mockBalance(userId: number, accountId: number | undefined, pin: unknown) {
  await verifyPin(userId, pin);
  const row = one<{ bank_name: string; last4: string; balance_paise: number }>(
    accountId
      ? "SELECT bank_name, last4, balance_paise FROM bank_accounts WHERE id = ? AND user_id = ? AND active = 1"
      : "SELECT bank_name, last4, balance_paise FROM bank_accounts WHERE user_id = ? AND active = 1 ORDER BY is_primary DESC, id LIMIT 1",
    ...(accountId ? [accountId, userId] : [userId])
  );
  if (!row) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Bank account nahi mila");
  return { label: `${row.bank_name} ••${row.last4}`, balance: rupees(row.balance_paise) };
}

export const linkedAccounts = (userId: number) =>
  many("SELECT id, bank_name, last4, is_primary FROM bank_accounts WHERE user_id = ? AND active = 1 ORDER BY is_primary DESC, id", userId);
