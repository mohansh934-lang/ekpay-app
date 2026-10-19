import { many, transaction } from "./db";
import { accountLabel, creditAccount, insertTxn, type Account } from "./ledger";

/**
 * Simulated "pending" (deferred) UPI transactions ko unke final status par le jaata hai.
 * Lazy hai: koi background job nahi, jab user state / history / status dekhta hai tab chalta hai.
 * Failed hone par paisa wapas aata hai (refund credit entry ke saath). `status='pending'` guard ki wajah se
 * ek txn do baar settle (aur do baar refund) nahi ho sakta.
 */
export function settlePending(userId: number) {
  const due = many<{ id: number; final_status: "success" | "failed" | null; amount_paise: number; bank_account_id: number | null; ref: string; counterparty: string }>(
    `SELECT id, final_status, amount_paise, bank_account_id, ref, counterparty FROM transactions
     WHERE user_id = ? AND status = 'pending' AND settles_at IS NOT NULL AND settles_at <= ?`,
    userId, Date.now()
  );
  if (!due.length) return 0;
  let n = 0;
  transaction((db) => {
    for (const t of due) {
      const final = t.final_status ?? "success";
      const reason = final === "failed" ? "Bank ne deferred transaction reverse kar di (simulated)" : null;
      const r = db
        .prepare("UPDATE transactions SET status = ?, failure_reason = ? WHERE id = ? AND user_id = ? AND status = 'pending'")
        .run(final, reason, t.id, userId);
      if (Number(r.changes) !== 1) continue;
      n++;
      if (final === "failed" && t.bank_account_id) {
        creditAccount(db, userId, t.bank_account_id, t.amount_paise);
        const acc = db.prepare("SELECT * FROM bank_accounts WHERE id = ?").get(t.bank_account_id) as unknown as Account;
        insertTxn(db, {
          userId, direction: "credit", category: "Refund", counterparty: t.counterparty,
          amountPaise: t.amount_paise, source: "EkPay UPI", bankAccountId: t.bank_account_id,
          bankLabel: accountLabel(acc), note: `Refund for ref ${t.ref}`,
        });
      }
    }
  });
  return n;
}
