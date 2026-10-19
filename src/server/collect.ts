import { config } from "./config";
import { ApiError } from "./errors";
import { many, one, run, transaction } from "./db";
import { optStr, posInt, rateLimit, str } from "./http";
import { rupees, toPaise } from "./money";
import { verifyPin } from "./auth";
import { accountLabel, creditAccount, debitAccount, getAccount, insertTxn } from "./ledger";

const VPA_RE = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/;

interface Row {
  id: number; requester_id: number; payer_id: number; amount_paise: number; note: string | null;
  status: "pending" | "approved" | "declined" | "cancelled" | "expired";
  created_at: number; expires_at: number; resolved_at: number | null; txn_id: number | null;
  requester_name: string; requester_vpa: string; payer_name: string; payer_vpa: string;
}

const SELECT = `
  SELECT c.*, rq.name AS requester_name, rq.upi_id AS requester_vpa, py.name AS payer_name, py.upi_id AS payer_vpa
  FROM collect_requests c
  JOIN users rq ON rq.id = c.requester_id
  JOIN users py ON py.id = c.payer_id`;

const map = (r: Row) => ({
  id: r.id, amount: rupees(r.amount_paise), note: r.note, status: r.status,
  createdAt: new Date(r.created_at).toISOString(), expiresAt: new Date(r.expires_at).toISOString(),
  resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
  requester: { name: r.requester_name, upiId: r.requester_vpa },
  payer: { name: r.payer_name, upiId: r.payer_vpa },
});

const expireOld = () =>
  run("UPDATE collect_requests SET status = 'expired', resolved_at = ? WHERE status = 'pending' AND expires_at < ?", Date.now(), Date.now());

/** Paisa maangna: payer ki UPI ID (is app ka user) par collect request. */
export function createCollect(userId: number, b: Record<string, unknown>) {
  rateLimit(`collect:${userId}`, 20, 60 * 60 * 1000);
  const vpa = str(b.payerVpa, "payerVpa", 3, 80).toLowerCase();
  if (!VPA_RE.test(vpa)) throw new ApiError(400, "INVALID_VPA", "UPI ID valid nahi hai (jaise name@bank)");
  const amountPaise = toPaise(b.amount, { max: config.maxUpiTxnPaise });
  const note = optStr(b.note, "note", 100);

  const payer = one<{ id: number }>("SELECT id FROM users WHERE upi_id = ?", vpa);
  if (!payer) throw new ApiError(404, "PAYER_NOT_FOUND", "Is UPI ID par koi EkPay user nahi mila");
  if (payer.id === userId) throw new ApiError(400, "SELF_REQUEST", "Khud se paisa nahi maang sakte");

  expireOld();
  const open = Number((one<{ c: number }>("SELECT COUNT(*) AS c FROM collect_requests WHERE requester_id = ? AND status = 'pending'", userId))!.c);
  if (open >= 10) throw new ApiError(429, "TOO_MANY_REQUESTS", "Pehle ke pending requests nipta lo (max 10)");

  const now = Date.now();
  const res = run(
    "INSERT INTO collect_requests (requester_id, payer_id, amount_paise, note, created_at, expires_at) VALUES (?,?,?,?,?,?)",
    userId, payer.id, amountPaise, note ?? null, now, now + config.collectExpiryMs
  );
  return map(one<Row>(`${SELECT} WHERE c.id = ?`, Number(res.lastInsertRowid))!);
}

export function listCollect(userId: number) {
  expireOld();
  return {
    incoming: many<Row>(`${SELECT} WHERE c.payer_id = ? ORDER BY c.id DESC LIMIT 30`, userId).map(map),
    outgoing: many<Row>(`${SELECT} WHERE c.requester_id = ? ORDER BY c.id DESC LIMIT 30`, userId).map(map),
  };
}

/**
 * approve (payer, PIN zaroori) / decline (payer) / cancel (requester).
 * Approve: request ko pehle 'approved' mark karte hain (guard: status='pending'), tab debit+credit, sab ek transaction me,
 * isliye do baar approve ya approve+cancel ki race me paisa do baar nahi kat sakta.
 */
export async function resolveCollect(userId: number, id: number, b: Record<string, unknown>) {
  const action = b.action;
  if (action !== "approve" && action !== "decline" && action !== "cancel") {
    throw new ApiError(400, "INVALID_INPUT", "action approve, decline ya cancel hona chahiye");
  }
  expireOld();
  const req = one<Row>(`${SELECT} WHERE c.id = ?`, id);
  const mine = req && (action === "cancel" ? req.requester_id === userId : req.payer_id === userId);
  if (!req || !mine) throw new ApiError(404, "REQUEST_NOT_FOUND", "Request nahi mili"); // dusre ki request ka pata bhi nahi chalega
  if (req.status !== "pending") throw new ApiError(409, "NOT_PENDING", `Ye request ab ${req.status} hai`);

  if (action !== "approve") {
    const r = run("UPDATE collect_requests SET status = ?, resolved_at = ? WHERE id = ? AND status = 'pending'",
      action === "decline" ? "declined" : "cancelled", Date.now(), id);
    if (Number(r.changes) !== 1) throw new ApiError(409, "NOT_PENDING", "Ye request ab pending nahi hai");
    return map(one<Row>(`${SELECT} WHERE c.id = ?`, id)!);
  }

  await verifyPin(userId, b.pin);
  const accountId = b.bankAccountId === undefined ? undefined : posInt(b.bankAccountId, "bankAccountId");

  transaction((db) => {
    const g = db.prepare("UPDATE collect_requests SET status = 'approved', resolved_at = ? WHERE id = ? AND status = 'pending' AND expires_at >= ?")
      .run(Date.now(), id, Date.now());
    if (Number(g.changes) !== 1) throw new ApiError(409, "NOT_PENDING", "Ye request ab pending nahi hai (expire ya already resolve)");

    const from = getAccount(db, userId, accountId);
    const to = getAccount(db, req.requester_id);
    debitAccount(db, userId, from.id, req.amount_paise);
    creditAccount(db, req.requester_id, to.id, req.amount_paise);
    const debit = insertTxn(db, {
      userId, direction: "debit", category: "Transfer", counterparty: req.requester_name, amountPaise: req.amount_paise,
      source: "EkPay UPI", bankAccountId: from.id, bankLabel: accountLabel(from), note: req.note ?? `collect #${id}`,
    });
    insertTxn(db, {
      userId: req.requester_id, direction: "credit", category: "Received", counterparty: req.payer_name, amountPaise: req.amount_paise,
      source: "EkPay UPI", bankAccountId: to.id, bankLabel: accountLabel(to), note: req.note ?? `collect #${id}`,
    });
    db.prepare("UPDATE collect_requests SET txn_id = ? WHERE id = ?").run(debit.id, id);
  });
  return map(one<Row>(`${SELECT} WHERE c.id = ?`, id)!);
}
