import type { DB } from "./db";

/**
 * Naye user ko demo data (koi real bank link nahi hai, ye ek simulator hai).
 * Values frontend ke purane demo data jaisi hain.
 */
export function seedDemoData(db: DB, userId: number) {
  const now = Date.now();
  const banks: [string, string, number, number][] = [
    ["HDFC Bank", "4521", 48230_00, 1],
    ["SBI", "7790", 12540_00, 0],
    ["ICICI Bank", "3306", 8915_00, 0],
  ];
  for (const [name, last4, bal, primary] of banks) {
    db.prepare(
      "INSERT INTO bank_accounts (user_id, bank_name, last4, balance_paise, is_primary, created_at) VALUES (?,?,?,?,?,?)"
    ).run(userId, name, last4, bal, primary, now);
  }
  db.prepare(
    "INSERT INTO wallets (user_id, lite_balance_paise, gold_ug, card_due_paise, budget_paise) VALUES (?,?,?,?,?)"
  ).run(userId, 420_00, 4_500_000, 18420_00, 25000_00);

  db.prepare("INSERT INTO loans (user_id, name, emi_paise, total_emis, paid_emis) VALUES (?,?,?,?,?)").run(
    userId, "Bike Loan", 3240_00, 36, 14
  );

  const holdings: [string, number, number][] = [
    ["RELIANCE", 12, 2780_00],
    ["TCS", 8, 3910_00],
    ["ZOMATO", 60, 215_00],
  ];
  for (const [sym, qty, avg] of holdings) {
    db.prepare("INSERT INTO holdings (user_id, symbol, qty, avg_price_paise) VALUES (?,?,?,?)").run(userId, sym, qty, avg);
  }

  const sips: [string, number, number][] = [
    ["Parag Parikh Flexi Cap", 2000_00, 5],
    ["Nippon India Small Cap", 1000_00, 5],
    ["SBI Bluechip", 1000_00, 10],
  ];
  for (const [name, amt, day] of sips) {
    db.prepare("INSERT INTO sips (user_id, name, amount_paise, day_of_month, created_at) VALUES (?,?,?,?,?)").run(
      userId, name, amt, day, now
    );
  }
}
