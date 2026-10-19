import { many, one } from "./db";
import { rupees } from "./money";
import { listTxns } from "./ledger";
import type { SessionUser } from "./auth";
import { getPrefs } from "./settings";
import { settlePending } from "./settle";

/** Ek call me poora dashboard snapshot (amounts rupees me, internally paise). */
export function getState(user: SessionUser) {
  const uid = user.id;
  settlePending(uid);
  const accounts = many<{ id: number; bank_name: string; last4: string; balance_paise: number; is_primary: number }>(
    "SELECT id, bank_name, last4, balance_paise, is_primary FROM bank_accounts WHERE user_id = ? AND active = 1 ORDER BY is_primary DESC, id", uid
  );
  const w = one<{ lite: number; gold: number; due: number; budget: number }>(
    "SELECT lite_balance_paise AS lite, gold_ug AS gold, card_due_paise AS due, budget_paise AS budget FROM wallets WHERE user_id = ?", uid
  )!;
  return {
    user: { name: user.name, phone: user.phone, upiId: user.upiId },
    banks: accounts.map((a) => ({
      id: a.id, name: a.bank_name, last4: a.last4, label: `${a.bank_name} ••${a.last4}`,
      balance: rupees(a.balance_paise), isPrimary: !!a.is_primary,
    })),
    totalBalance: rupees(accounts.reduce((s, a) => s + a.balance_paise, 0)),
    upiLiteBalance: rupees(w.lite),
    goldGrams: w.gold / 1_000_000,
    cardDue: rupees(w.due),
    budget: rupees(w.budget),
    settings: getPrefs(uid),
    loans: many<{ id: number; name: string; emi_paise: number; total_emis: number; paid_emis: number }>(
      "SELECT id, name, emi_paise, total_emis, paid_emis FROM loans WHERE user_id = ?", uid
    ).map((l) => ({ id: l.id, name: l.name, emi: rupees(l.emi_paise), totalEmis: l.total_emis, paidEmis: l.paid_emis })),
    holdings: many<{ symbol: string; qty: number; avg_price_paise: number }>(
      "SELECT symbol, qty, avg_price_paise FROM holdings WHERE user_id = ? ORDER BY symbol", uid
    ).map((h) => ({ symbol: h.symbol, qty: h.qty, avgPrice: rupees(h.avg_price_paise) })),
    sips: many<{ id: number; name: string; amount_paise: number; day_of_month: number }>(
      "SELECT id, name, amount_paise, day_of_month FROM sips WHERE user_id = ? ORDER BY day_of_month, id", uid
    ).map((s) => ({ id: s.id, name: s.name, amount: rupees(s.amount_paise), dayOfMonth: s.day_of_month })),
    recentTransactions: listTxns(uid, { limit: 10 }).transactions,
  };
}
