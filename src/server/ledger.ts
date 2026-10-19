import type { DB } from "./db";
import { many, one } from "./db";
import { ApiError } from "./errors";
import { randomDigits } from "./security";
import { rupees } from "./money";

export type TxnStatus = "success" | "pending" | "failed";

export interface TxnRow {
  id: number; direction: "debit" | "credit"; category: string; counterparty: string;
  amount_paise: number; source: string; bank_label: string; ref: string; note: string | null; created_at: number;
  status: TxnStatus; failure_reason: string | null;
}

export const mapTxn = (t: TxnRow) => ({
  id: t.id,
  type: t.direction,
  category: t.category,
  counterparty: t.counterparty,
  amount: rupees(t.amount_paise),
  source: t.source,
  bank: t.bank_label,
  ref: t.ref,
  note: t.note,
  status: t.status,
  failureReason: t.failure_reason,
  createdAt: new Date(t.created_at).toISOString(),
});

const COLS = "id, direction, category, counterparty, amount_paise, source, bank_label, ref, note, created_at, status, failure_reason";

export const findTxnByKey = (userId: number, key: string) =>
  one<TxnRow>(`SELECT ${COLS} FROM transactions WHERE user_id = ? AND idempotency_key = ?`, userId, key);

/** Sirf apni transaction (user_id scoped = IDOR safe). */
export const findTxnById = (userId: number, id: number) =>
  one<TxnRow>(`SELECT ${COLS} FROM transactions WHERE user_id = ? AND id = ?`, userId, id);

/**
 * Idempotency: same key dobara aaye to purana result lautao. Lekin agar amount alag hai to reject karo
 * (client bug ya galat key reuse, warna user ko lagega ₹9,000 gaye jabki purana ₹100 wala result mila).
 */
export function replayFor(userId: number, key: string | undefined, expectedPaise?: number) {
  if (!key) return null;
  const prev = findTxnByKey(userId, key);
  if (!prev) return null;
  if (expectedPaise !== undefined && prev.amount_paise !== expectedPaise) {
    throw new ApiError(409, "IDEMPOTENCY_KEY_REUSED", "Ye idempotencyKey pehle kisi aur amount ke saath use ho chuki hai");
  }
  return { replayed: true as const, transaction: mapTxn(prev) };
}

export function insertTxn(
  db: DB,
  t: {
    userId: number; direction: "debit" | "credit"; category: string; counterparty: string;
    amountPaise: number; source: string; bankAccountId: number | null; bankLabel: string;
    note?: string; idempotencyKey?: string;
    /** default "success". "pending" ke saath settlesAt + finalStatus do. */
    status?: TxnStatus; settlesAt?: number; finalStatus?: "success" | "failed"; failureReason?: string;
  }
) {
  let ref = "";
  for (let i = 0; i < 5; i++) {
    ref = "4" + randomDigits(11); // 12-digit UTR-style reference
    if (!db.prepare("SELECT 1 FROM transactions WHERE ref = ?").get(ref)) break;
    if (i === 4) throw new Error("Could not generate unique ref");
  }
  const res = db
    .prepare(
      `INSERT INTO transactions (user_id, direction, category, counterparty, amount_paise, source, bank_account_id,
        bank_label, ref, note, idempotency_key, created_at, status, settles_at, final_status, failure_reason)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      t.userId, t.direction, t.category, t.counterparty, t.amountPaise, t.source, t.bankAccountId,
      t.bankLabel, ref, t.note ?? null, t.idempotencyKey ?? null, Date.now(),
      t.status ?? "success", t.settlesAt ?? null, t.finalStatus ?? null, t.failureReason ?? null
    );
  return mapTxn(
    db.prepare(`SELECT ${COLS} FROM transactions WHERE id = ?`).get(Number(res.lastInsertRowid)) as unknown as TxnRow
  );
}

export interface Account { id: number; bank_name: string; last4: string; balance_paise: number; is_primary: number }

/**
 * Account user ka hi hona chahiye (ownership check = IDOR protection) aur active (unlink nahi hua).
 * accountId na ho to primary.
 */
export function getAccount(db: DB, userId: number, accountId?: number): Account {
  const acc = (accountId
    ? db.prepare("SELECT * FROM bank_accounts WHERE id = ? AND user_id = ? AND active = 1").get(accountId, userId)
    : db.prepare("SELECT * FROM bank_accounts WHERE user_id = ? AND active = 1 ORDER BY is_primary DESC, id LIMIT 1").get(userId)
  ) as Account | undefined;
  if (!acc) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Bank account nahi mila");
  return acc;
}
export const accountLabel = (a: Account) => `${a.bank_name} ••${a.last4}`;

/** Atomic debit: balance kabhi negative nahi ho sakta. */
export function debitAccount(db: DB, userId: number, accountId: number, paise: number) {
  const r = db
    .prepare("UPDATE bank_accounts SET balance_paise = balance_paise - ? WHERE id = ? AND user_id = ? AND balance_paise >= ?")
    .run(paise, accountId, userId, paise);
  if (Number(r.changes) !== 1) throw new ApiError(409, "INSUFFICIENT_FUNDS", "Account me balance kam hai");
}
export const creditAccount = (db: DB, userId: number, accountId: number, paise: number) =>
  db.prepare("UPDATE bank_accounts SET balance_paise = balance_paise + ? WHERE id = ? AND user_id = ?").run(paise, accountId, userId);

export interface ListFilter { limit: number; before?: number; category?: string; q?: string; status?: TxnStatus }
export function listTxns(userId: number, f: ListFilter) {
  const where = ["user_id = ?"];
  const params: (string | number)[] = [userId];
  if (f.before) { where.push("id < ?"); params.push(f.before); }
  if (f.category) { where.push("category = ?"); params.push(f.category); }
  if (f.status) { where.push("status = ?"); params.push(f.status); }
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, "\\$&")}%`;
    where.push("(counterparty LIKE ? ESCAPE '\\' OR ref LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }
  const rows = many<TxnRow>(
    `SELECT ${COLS} FROM transactions WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ?`,
    ...params, f.limit + 1
  );
  const page = rows.slice(0, f.limit);
  return {
    transactions: page.map(mapTxn),
    nextCursor: rows.length > f.limit ? page[page.length - 1].id : null,
  };
}
