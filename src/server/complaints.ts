import { config } from "./config";
import { ApiError, isUniqueViolation } from "./errors";
import { many, one, run } from "./db";
import { posInt, rateLimit, str } from "./http";
import { randomDigits } from "./security";

export const COMPLAINT_CATEGORIES = [
  "debited_not_received", "failed_but_debited", "wrong_payee", "duplicate_charge", "pending_too_long", "other",
] as const;

interface Row {
  id: number; txn_id: number; ticket: string; category: string; description: string;
  status: "open" | "in_review" | "resolved" | "rejected"; resolution: string | null; created_at: number; updated_at: number;
  ref: string; counterparty: string; amount_paise: number;
}

const SELECT = `SELECT c.*, t.ref, t.counterparty, t.amount_paise FROM complaints c JOIN transactions t ON t.id = c.txn_id`;

const map = (r: Row) => ({
  id: r.id, ticket: r.ticket, txnId: r.txn_id, category: r.category, description: r.description,
  status: r.status, resolution: r.resolution,
  createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString(),
  transaction: { ref: r.ref, counterparty: r.counterparty, amount: r.amount_paise / 100 },
});

/** DEMO: real me status bank/NPCI se aata hai. Yahan time ke hisaab se open -> in_review -> resolved. */
function advanceDemo(userId: number) {
  if (!config.demoMode) return;
  const now = Date.now();
  run(
    "UPDATE complaints SET status = 'resolved', resolution = 'Demo mode: ticket apne aap close hua', updated_at = ? WHERE user_id = ? AND status IN ('open','in_review') AND created_at < ?",
    now, userId, now - config.complaintResolveMs
  );
  run("UPDATE complaints SET status = 'in_review', updated_at = ? WHERE user_id = ? AND status = 'open' AND created_at < ?",
    now, userId, now - config.complaintReviewMs);
}

export function createComplaint(userId: number, b: Record<string, unknown>) {
  rateLimit(`complaint:${userId}`, 10, 60 * 60 * 1000);
  const txnId = posInt(b.txnId, "txnId");
  if (typeof b.category !== "string" || !(COMPLAINT_CATEGORIES as readonly string[]).includes(b.category)) {
    throw new ApiError(400, "INVALID_INPUT", `category in me se ek hona chahiye: ${COMPLAINT_CATEGORIES.join(", ")}`);
  }
  const description = str(b.description, "description", 10, 500);
  if (!one("SELECT 1 FROM transactions WHERE id = ? AND user_id = ?", txnId, userId)) {
    throw new ApiError(404, "TXN_NOT_FOUND", "Transaction nahi mili");
  }
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    const ticket = "CMP" + randomDigits(8);
    try {
      const res = run(
        "INSERT INTO complaints (user_id, txn_id, ticket, category, description, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        userId, txnId, ticket, b.category, description, now, now
      );
      return map(one<Row>(`${SELECT} WHERE c.id = ?`, Number(res.lastInsertRowid))!);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // ya to ticket collide hua (dobara try) ya is txn par pehle se active complaint hai
      if (/complaints\.txn_id/i.test((e as Error).message)) {
        throw new ApiError(409, "COMPLAINT_EXISTS", "Is transaction par complaint pehle se chal rahi hai");
      }
    }
  }
  throw new Error("Could not generate unique ticket");
}

export function listComplaints(userId: number) {
  advanceDemo(userId);
  return many<Row>(`${SELECT} WHERE c.user_id = ? ORDER BY c.id DESC LIMIT 50`, userId).map(map);
}
