import { config } from "./config";
import { ApiError } from "./errors";
import { transaction } from "./db";
import { idemKey, optStr, posInt, str } from "./http";
import { toPaise, rupees } from "./money";
import { verifyNpciClCredential } from "./npci-cl";
import {
  accountLabel, debitAccount, getAccount, insertTxn, replayFor,
} from "./ledger";

const VPA_RE = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/;
const CATEGORY_RE = /^[A-Za-z][A-Za-z &]{1,29}$/;

const replay = (userId: number, key: string, expectedPaise: number) => replayFor(userId, key, expectedPaise);

/** UPI payment: bank se (PIN zaroori) ya UPI Lite se (PIN nahi, chhote amount). */
export async function pay(userId: number, b: Record<string, unknown>) {
  const method = b.method === "lite" ? "lite" : "bank";
  const amountPaise = toPaise(b.amount, { max: config.maxUpiTxnPaise });
  const receiver = str(b.receiver, "receiver", 1, 80);
  const vpa = optStr(b.vpa, "vpa", 80);
  if (vpa && !VPA_RE.test(vpa)) throw new ApiError(400, "INVALID_VPA", "UPI ID valid nahi hai (jaise name@bank)");
  const note = optStr(b.note, "note", 100);
  const category = b.category === undefined ? "Transfer" : str(b.category, "category", 2, 30);
  if (!CATEGORY_RE.test(category)) throw new ApiError(400, "INVALID_INPUT", "category valid nahi hai");
  const key = idemKey(b.idempotencyKey);
  const accountId = b.bankAccountId === undefined ? undefined : posInt(b.bankAccountId, "bankAccountId");

  if (key) { const r = replay(userId, key, amountPaise); if (r) return r; }

  if (method === "bank") await verifyNpciClCredential(userId, b.pin);
  else if (amountPaise > config.upiLite.maxTxnPaise) {
    throw new ApiError(400, "LITE_LIMIT", `UPI Lite se max ₹${rupees(config.upiLite.maxTxnPaise)} tak hi pay ho sakta hai`);
  }

  return transaction((db) => {
    if (key) { const r = replay(userId, key, amountPaise); if (r) return r; } // race: dono request ek saath aayi

    let source = "UPI Lite", bankLabel = "UPI Lite Wallet", bankAccountId: number | null = null;
    let newBalance: number;
    if (method === "bank") {
      const acc = getAccount(db, userId, accountId);
      debitAccount(db, userId, acc.id, amountPaise);
      source = "EkPay UPI"; bankLabel = accountLabel(acc); bankAccountId = acc.id;
      newBalance = acc.balance_paise - amountPaise;
    } else {
      const r = db
        .prepare("UPDATE wallets SET lite_balance_paise = lite_balance_paise - ? WHERE user_id = ? AND lite_balance_paise >= ?")
        .run(amountPaise, userId, amountPaise);
      if (Number(r.changes) !== 1) throw new ApiError(409, "INSUFFICIENT_FUNDS", "UPI Lite balance kam hai");
      newBalance = (db.prepare("SELECT lite_balance_paise AS b FROM wallets WHERE user_id = ?").get(userId) as { b: number }).b;
    }
    const transactionRow = insertTxn(db, {
      userId, direction: "debit", category, counterparty: receiver, amountPaise, source,
      bankAccountId, bankLabel, note: note ?? (vpa ? `to ${vpa}` : undefined), idempotencyKey: key,
    });
    return { replayed: false as const, transaction: transactionRow, balance: rupees(newBalance) };
  });
}

/** Bank se UPI Lite wallet me paisa daalna (PIN zaroori). */
export async function topUpLite(userId: number, b: Record<string, unknown>) {
  const amountPaise = toPaise(b.amount, { max: config.upiLite.maxBalancePaise });
  const accountId = b.bankAccountId === undefined ? undefined : posInt(b.bankAccountId, "bankAccountId");
  const key = idemKey(b.idempotencyKey);
  if (key) { const r = replay(userId, key, amountPaise); if (r) return r; }

  await verifyNpciClCredential(userId, b.pin);

  return transaction((db) => {
    if (key) { const r = replay(userId, key, amountPaise); if (r) return r; }
    const w = db.prepare("SELECT lite_balance_paise AS b FROM wallets WHERE user_id = ?").get(userId) as { b: number };
    if (w.b + amountPaise > config.upiLite.maxBalancePaise) {
      throw new ApiError(400, "LITE_BALANCE_LIMIT", `UPI Lite balance max ₹${rupees(config.upiLite.maxBalancePaise)} ho sakta hai`);
    }
    const acc = getAccount(db, userId, accountId);
    debitAccount(db, userId, acc.id, amountPaise);
    db.prepare("UPDATE wallets SET lite_balance_paise = lite_balance_paise + ? WHERE user_id = ?").run(amountPaise, userId);
    const t = insertTxn(db, {
      userId, direction: "debit", category: "Transfer", counterparty: "UPI Lite Top-up", amountPaise,
      source: "EkPay UPI", bankAccountId: acc.id, bankLabel: accountLabel(acc), idempotencyKey: key,
    });
    return { replayed: false as const, transaction: t, liteBalance: rupees(w.b + amountPaise) };
  });
}
