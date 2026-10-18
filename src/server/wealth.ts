import { config } from "./config";
import { ApiError } from "./errors";
import { transaction } from "./db";
import { idemKey, posInt, rateLimit, str } from "./http";
import { rupees, toPaise } from "./money";
import { findOffering } from "./catalog";
import { getQuote } from "./market";
import {
  accountLabel, creditAccount, debitAccount, findTxnByKey, getAccount, insertTxn, mapTxn,
} from "./ledger";

const replay = (userId: number, key: string) => {
  const prev = findTxnByKey(userId, key);
  return prev ? { replayed: true as const, transaction: mapTxn(prev) } : null;
};
const optAccount = (v: unknown) => (v === undefined ? undefined : posInt(v, "bankAccountId"));

/** Stock buy/sell. Price SERVER decide karta hai; client price bhej bhi de to ignore. */
export function trade(userId: number, b: Record<string, unknown>) {
  const symbol = str(b.symbol, "symbol", 1, 20).toUpperCase();
  if (b.side !== "buy" && b.side !== "sell") throw new ApiError(400, "INVALID_INPUT", "side 'buy' ya 'sell' hona chahiye");
  const side = b.side;
  const qty = posInt(b.qty, "qty", 10_000);
  const quote = getQuote(symbol);
  if (!quote) throw new ApiError(404, "UNKNOWN_SYMBOL", "Ye stock available nahi hai");
  const key = idemKey(b.idempotencyKey);
  const accountId = optAccount(b.bankAccountId);

  return transaction((db) => {
    if (key) { const r = replay(userId, key); if (r) return r; }
    const acc = getAccount(db, userId, accountId);
    const price = quote.pricePaise;
    const total = price * qty;
    const held = db.prepare("SELECT qty, avg_price_paise AS avg FROM holdings WHERE user_id = ? AND symbol = ?")
      .get(userId, symbol) as { qty: number; avg: number } | undefined;

    if (side === "buy") {
      debitAccount(db, userId, acc.id, total);
      if (held) {
        const newQty = held.qty + qty;
        const newAvg = Math.round((held.qty * held.avg + qty * price) / newQty); // weighted average
        db.prepare("UPDATE holdings SET qty = ?, avg_price_paise = ? WHERE user_id = ? AND symbol = ?").run(newQty, newAvg, userId, symbol);
      } else {
        db.prepare("INSERT INTO holdings (user_id, symbol, qty, avg_price_paise) VALUES (?,?,?,?)").run(userId, symbol, qty, price);
      }
    } else {
      if (!held || held.qty < qty) throw new ApiError(409, "INSUFFICIENT_HOLDINGS", "Itne shares aapke paas nahi hain");
      if (held.qty === qty) db.prepare("DELETE FROM holdings WHERE user_id = ? AND symbol = ?").run(userId, symbol);
      else db.prepare("UPDATE holdings SET qty = qty - ? WHERE user_id = ? AND symbol = ?").run(qty, userId, symbol);
      creditAccount(db, userId, acc.id, total);
    }

    const t = insertTxn(db, {
      userId, direction: side === "buy" ? "debit" : "credit",
      category: side === "buy" ? "Investment" : "Income",
      counterparty: `${side === "buy" ? "Buy" : "Sell"} ${symbol} × ${qty}`,
      amountPaise: total, source: "EkPay Invest", bankAccountId: acc.id, bankLabel: accountLabel(acc), idempotencyKey: key,
    });
    const order = db
      .prepare("INSERT INTO orders (user_id, symbol, side, qty, price_paise, total_paise, txn_id, created_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(userId, symbol, side, qty, price, total, t.id, Date.now());
    return {
      replayed: false as const, transaction: t,
      order: { id: Number(order.lastInsertRowid), symbol, side, qty, price: rupees(price), total: rupees(total) },
    };
  });
}

/** Digital gold: microgram integer me store hota hai. User se exactly wahi amount katta hai jo usne bola. */
export function buyGold(userId: number, b: Record<string, unknown>) {
  const amountPaise = toPaise(b.amount, { min: 10_00, max: 100_000_00 });
  const key = idemKey(b.idempotencyKey);
  const accountId = optAccount(b.bankAccountId);
  const ug = Math.floor((amountPaise * 1_000_000) / config.goldPricePerGramPaise);
  if (ug < 1) throw new ApiError(400, "AMOUNT_TOO_LOW", "Amount bahut kam hai");

  return transaction((db) => {
    if (key) { const r = replay(userId, key); if (r) return r; }
    const acc = getAccount(db, userId, accountId);
    debitAccount(db, userId, acc.id, amountPaise);
    db.prepare("UPDATE wallets SET gold_ug = gold_ug + ? WHERE user_id = ?").run(ug, userId);
    const t = insertTxn(db, {
      userId, direction: "debit", category: "Investment", counterparty: "24K Digital Gold",
      amountPaise, source: "EkPay Invest", bankAccountId: acc.id, bankLabel: accountLabel(acc), idempotencyKey: key,
    });
    const g = db.prepare("SELECT gold_ug AS g FROM wallets WHERE user_id = ?").get(userId) as { g: number };
    return { replayed: false as const, transaction: t, boughtGrams: ug / 1_000_000, totalGrams: g.g / 1_000_000 };
  });
}

/** Loan EMI: server decide karta hai EMI amount aur kitni baaki hain. */
export function payEmi(userId: number, b: Record<string, unknown>) {
  const loanId = posInt(b.loanId, "loanId");
  const key = idemKey(b.idempotencyKey);
  const accountId = optAccount(b.bankAccountId);

  return transaction((db) => {
    if (key) { const r = replay(userId, key); if (r) return r; }
    const loan = db.prepare("SELECT * FROM loans WHERE id = ? AND user_id = ?").get(loanId, userId) as
      | { id: number; name: string; emi_paise: number; total_emis: number; paid_emis: number }
      | undefined;
    if (!loan) throw new ApiError(404, "LOAN_NOT_FOUND", "Loan nahi mila");
    if (loan.paid_emis >= loan.total_emis) throw new ApiError(409, "LOAN_CLOSED", "Ye loan poora chukaya ja chuka hai");

    const acc = getAccount(db, userId, accountId);
    debitAccount(db, userId, acc.id, loan.emi_paise);
    db.prepare("UPDATE loans SET paid_emis = paid_emis + 1 WHERE id = ?").run(loan.id);
    const t = insertTxn(db, {
      userId, direction: "debit", category: "Bills", counterparty: `${loan.name} EMI`,
      amountPaise: loan.emi_paise, source: "EkPay UPI", bankAccountId: acc.id, bankLabel: accountLabel(acc), idempotencyKey: key,
    });
    return { replayed: false as const, transaction: t, paidEmis: loan.paid_emis + 1, totalEmis: loan.total_emis };
  });
}

/** SIP register karta hai. payFirstInstallment=true ho to pehli installment usi transaction me katti hai. */
export function createSip(userId: number, b: Record<string, unknown>) {
  const name = str(b.name, "name", 2, 60);
  const amountPaise = toPaise(b.amount, { min: 100_00, max: 10_00_000_00 });
  const day = posInt(b.dayOfMonth, "dayOfMonth", 28);
  const payFirst = b.payFirstInstallment === true;
  const key = idemKey(b.idempotencyKey);
  const accountId = optAccount(b.bankAccountId);

  return transaction((db) => {
    if (payFirst && key) { const r = replay(userId, key); if (r) return { ...r, sip: null }; }
    const count = (db.prepare("SELECT COUNT(*) AS c FROM sips WHERE user_id = ?").get(userId) as { c: number }).c;
    if (count >= 20) throw new ApiError(409, "SIP_LIMIT", "Max 20 SIPs allowed hain");

    let t: ReturnType<typeof insertTxn> | undefined;
    if (payFirst) {
      const acc = getAccount(db, userId, accountId);
      debitAccount(db, userId, acc.id, amountPaise);
      t = insertTxn(db, {
        userId, direction: "debit", category: "Investment", counterparty: `SIP: ${name}`,
        amountPaise, source: "EkPay Invest", bankAccountId: acc.id, bankLabel: accountLabel(acc), idempotencyKey: key,
      });
    }
    const r = db.prepare("INSERT INTO sips (user_id, name, amount_paise, day_of_month, created_at) VALUES (?,?,?,?,?)")
      .run(userId, name, amountPaise, day, Date.now());
    return {
      replayed: false as const,
      transaction: t,
      sip: { id: Number(r.lastInsertRowid), name, amount: rupees(amountPaise), dayOfMonth: day },
    };
  });
}

export function deleteSip(userId: number, sipId: number) {
  return transaction((db) => {
    const r = db.prepare("DELETE FROM sips WHERE id = ? AND user_id = ?").run(sipId, userId);
    if (Number(r.changes) !== 1) throw new ApiError(404, "SIP_NOT_FOUND", "SIP nahi mili");
  });
}

export function setBudget(userId: number, b: Record<string, unknown>) {
  const paise = toPaise(b.budget, { min: 100_00, max: config.maxBudgetPaise, field: "budget" });
  transaction((db) => db.prepare("UPDATE wallets SET budget_paise = ? WHERE user_id = ?").run(paise, userId));
  return rupees(paise);
}

/** Credit card bill: default me poora due, ya `amount` (due se zyada nahi) bhej kar partial. */
export function payCardBill(userId: number, b: Record<string, unknown>) {
  const key = idemKey(b.idempotencyKey);
  const accountId = optAccount(b.bankAccountId);

  return transaction((db) => {
    if (key) { const r = replay(userId, key); if (r) return r; }
    const w = db.prepare("SELECT card_due_paise AS due FROM wallets WHERE user_id = ?").get(userId) as { due: number };
    if (w.due <= 0) throw new ApiError(409, "NO_DUE", "Koi bill baaki nahi hai");
    const amountPaise = b.amount === undefined ? w.due : toPaise(b.amount, { max: w.due });

    const acc = getAccount(db, userId, accountId);
    debitAccount(db, userId, acc.id, amountPaise);
    db.prepare("UPDATE wallets SET card_due_paise = card_due_paise - ? WHERE user_id = ?").run(amountPaise, userId);
    const t = insertTxn(db, {
      userId, direction: "debit", category: "Bills", counterparty: "HDFC Credit Card Bill",
      amountPaise, source: "EkPay UPI", bankAccountId: acc.id, bankLabel: accountLabel(acc), idempotencyKey: key,
    });
    return { replayed: false as const, transaction: t, remainingDue: rupees(w.due - amountPaise) };
  });
}

/** Apne hi do accounts ke beech transfer (PIN nahi chahiye, paisa user ka hi rehta hai). */
export function selfTransfer(userId: number, b: Record<string, unknown>) {
  const fromId = posInt(b.fromAccountId, "fromAccountId");
  const toId = posInt(b.toAccountId, "toAccountId");
  if (fromId === toId) throw new ApiError(400, "SAME_ACCOUNT", "Alag-alag banks chuno");
  const amountPaise = toPaise(b.amount, { max: config.maxUpiTxnPaise });
  const key = idemKey(b.idempotencyKey);

  return transaction((db) => {
    if (key) { const r = replay(userId, key); if (r) return r; }
    const from = getAccount(db, userId, fromId);
    const to = getAccount(db, userId, toId); // dono accounts isi user ke hone chahiye
    debitAccount(db, userId, from.id, amountPaise);
    creditAccount(db, userId, to.id, amountPaise);
    const debit = insertTxn(db, {
      userId, direction: "debit", category: "Self Transfer", counterparty: `To ${accountLabel(to)}`,
      amountPaise, source: "EkPay UPI", bankAccountId: from.id, bankLabel: accountLabel(from), idempotencyKey: key,
    });
    insertTxn(db, {
      userId, direction: "credit", category: "Self Transfer", counterparty: `From ${accountLabel(from)}`,
      amountPaise, source: "EkPay UPI", bankAccountId: to.id, bankLabel: accountLabel(to),
    });
    return { replayed: false as const, transaction: debit };
  });
}

/** Insurance / FD / IPO / NPS khareedna. Price server ke catalog se aata hai. */
export function buyOffering(userId: number, b: Record<string, unknown>) {
  const category = str(b.category, "category", 2, 20);
  const title = str(b.title, "title", 2, 80);
  const offering = findOffering(category, title);
  if (!offering) throw new ApiError(404, "OFFERING_NOT_FOUND", "Ye plan available nahi hai");
  const key = idemKey(b.idempotencyKey);
  const accountId = optAccount(b.bankAccountId);

  return transaction((db) => {
    if (key) { const r = replay(userId, key); if (r) return r; }
    const acc = getAccount(db, userId, accountId);
    debitAccount(db, userId, acc.id, offering.pricePaise);
    const t = insertTxn(db, {
      userId, direction: "debit", category: "Investment", counterparty: offering.title,
      amountPaise: offering.pricePaise, source: "EkPay Invest", bankAccountId: acc.id,
      bankLabel: accountLabel(acc), idempotencyKey: key,
    });
    return { replayed: false as const, transaction: t };
  });
}

/**
 * DEMO ONLY: simulator me "add money" button ke liye. Real app me ye endpoint exist hi nahi karega
 * (paisa bank se aata hai). Isliye per-user rate limit + per-click cap.
 */
export function demoDeposit(userId: number, b: Record<string, unknown>) {
  rateLimit(`deposit:${userId}`, 20, 60 * 60 * 1000);
  const amountPaise = toPaise(b.amount, { max: config.maxDepositPaise });
  const key = idemKey(b.idempotencyKey);
  const accountId = optAccount(b.bankAccountId);

  return transaction((db) => {
    if (key) { const r = replay(userId, key); if (r) return r; }
    const acc = getAccount(db, userId, accountId);
    creditAccount(db, userId, acc.id, amountPaise);
    const t = insertTxn(db, {
      userId, direction: "credit", category: "Income", counterparty: "Self Deposit / Top-up",
      amountPaise, source: "Demo Top-up", bankAccountId: acc.id, bankLabel: accountLabel(acc), idempotencyKey: key,
    });
    return { replayed: false as const, transaction: t };
  });
}
