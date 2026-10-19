import { config } from "./config";
import { ApiError } from "./errors";
import { one, transaction } from "./db";
import { idemKey, optStr, posInt, str } from "./http";
import { toPaise, rupees } from "./money";
import { verifyPin } from "./auth";
import {
  accountLabel, creditAccount, debitAccount, getAccount, insertTxn, replayFor,
} from "./ledger";

const VPA_RE = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/;
const CATEGORY_RE = /^[A-Za-z][A-Za-z &]{1,29}$/;

const replay = (userId: number, key: string, expectedPaise: number) => replayFor(userId, key, expectedPaise);

/** Test/demo ke liye UPI ke alag-alag outcomes simulate karna (sirf EK_DEMO_MODE me). */
export const SIMULATIONS = ["pending", "deferred_failed", "failed", "bank_down"] as const;
type Simulation = (typeof SIMULATIONS)[number];

function parseSimulation(v: unknown, method: "bank" | "lite"): Simulation | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (!config.demoMode) throw new ApiError(400, "INVALID_INPUT", "simulate sirf demo mode me allowed hai");
  if (typeof v !== "string" || !(SIMULATIONS as readonly string[]).includes(v)) {
    throw new ApiError(400, "INVALID_INPUT", `simulate in me se ek hona chahiye: ${SIMULATIONS.join(", ")}`);
  }
  if (method !== "bank") throw new ApiError(400, "INVALID_INPUT", "simulate sirf bank payment par chalta hai");
  return v as Simulation;
}

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
  const sim = parseSimulation(b.simulate, method);

  if (key) { const r = replay(userId, key, amountPaise); if (r) return r; }

  if (method === "bank") await verifyPin(userId, b.pin);
  else if (amountPaise > config.upiLite.maxTxnPaise) {
    throw new ApiError(400, "LITE_LIMIT", `UPI Lite se max ₹${rupees(config.upiLite.maxTxnPaise)} tak hi pay ho sakta hai`);
  }

  if (sim === "bank_down") {
    throw new ApiError(503, "BANK_DOWN", "Bank server abhi available nahi hai, thodi der baad try karo (simulated)");
  }

  return transaction((db) => {
    if (key) { const r = replay(userId, key, amountPaise); if (r) return r; } // race: dono request ek saath aayi

    // Receiver is app ka user hai to uska ASLI naam dikhao (client ka bheja `receiver` text spoof ho sakta hai, jaise "Amazon").
    const rx = vpa ? one<{ id: number; name: string }>("SELECT id, name FROM users WHERE upi_id = ?", vpa.toLowerCase()) : undefined;
    const rxUser = rx && rx.id !== userId ? rx : undefined;
    const payee = rxUser ? rxUser.name : receiver;

    let source = "UPI Lite", bankLabel = "UPI Lite Wallet", bankAccountId: number | null = null;
    let newBalance: number;
    if (method === "bank") {
      const acc = getAccount(db, userId, accountId);
      source = "EkPay UPI"; bankLabel = accountLabel(acc); bankAccountId = acc.id;

      if (sim === "failed") {
        // Bank ne decline kiya: paisa kata hi nahi, sirf failed entry history me.
        const failedTxn = insertTxn(db, {
          userId, direction: "debit", category, counterparty: payee, amountPaise, source,
          bankAccountId, bankLabel, note: note ?? (vpa ? `to ${vpa}` : undefined), idempotencyKey: key,
          status: "failed", failureReason: "Remitter bank ne transaction decline kiya (simulated)",
        });
        return { replayed: false as const, transaction: failedTxn, balance: rupees(acc.balance_paise) };
      }

      debitAccount(db, userId, acc.id, amountPaise);
      newBalance = acc.balance_paise - amountPaise;

      if (sim === "pending" || sim === "deferred_failed") {
        // Paisa hold (debit) ho gaya, final result baad me aayega (settle.ts). Receiver credit tab tak nahi.
        const pendingTxn = insertTxn(db, {
          userId, direction: "debit", category, counterparty: payee, amountPaise, source,
          bankAccountId, bankLabel, note: note ?? (vpa ? `to ${vpa}` : undefined), idempotencyKey: key,
          status: "pending", settlesAt: Date.now() + config.pendingSettleMs,
          finalStatus: sim === "pending" ? "success" : "failed",
        });
        return { replayed: false as const, transaction: pendingTxn, balance: rupees(newBalance) };
      }
    } else {
      const r = db
        .prepare("UPDATE wallets SET lite_balance_paise = lite_balance_paise - ? WHERE user_id = ? AND lite_balance_paise >= ?")
        .run(amountPaise, userId, amountPaise);
      if (Number(r.changes) !== 1) throw new ApiError(409, "INSUFFICIENT_FUNDS", "UPI Lite balance kam hai");
      newBalance = (db.prepare("SELECT lite_balance_paise AS b FROM wallets WHERE user_id = ?").get(userId) as { b: number }).b;
    }

    const transactionRow = insertTxn(db, {
      userId, direction: "debit", category, counterparty: payee, amountPaise, source,
      bankAccountId, bankLabel, note: note ?? (vpa ? `to ${vpa}` : undefined), idempotencyKey: key,
    });

    // Agar receiver is app ka hi user hai (uski UPI ID match hui), to uske primary account me credit bhi karo.
    if (rxUser) {
      const me = db.prepare("SELECT name FROM users WHERE id = ?").get(userId) as { name: string };
      let racc;
      try { racc = getAccount(db, rxUser.id); } catch { throw new ApiError(409, "RECEIVER_UNAVAILABLE", "Receiver ka koi active bank account nahi hai"); }
      creditAccount(db, rxUser.id, racc.id, amountPaise);
      insertTxn(db, {
        userId: rxUser.id, direction: "credit", category: "Received", counterparty: me.name, amountPaise,
        source: "EkPay UPI", bankAccountId: racc.id, bankLabel: accountLabel(racc), note: note ?? `from ${me.name}`,
      });
    }
    return { replayed: false as const, transaction: transactionRow, balance: rupees(newBalance) };
  });
}

/** Bank se UPI Lite wallet me paisa daalna (PIN zaroori). */
export async function topUpLite(userId: number, b: Record<string, unknown>) {
  const amountPaise = toPaise(b.amount, { max: config.upiLite.maxBalancePaise });
  const accountId = b.bankAccountId === undefined ? undefined : posInt(b.bankAccountId, "bankAccountId");
  const key = idemKey(b.idempotencyKey);
  if (key) { const r = replay(userId, key, amountPaise); if (r) return r; }

  await verifyPin(userId, b.pin);

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
