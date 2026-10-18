import path from "node:path";

/** Sab tunable limits ek jagah. Amounts paise me hain (1 rupee = 100 paise). */
export const config = {
  dbPath: process.env.EK_DB_PATH || path.join(process.cwd(), "data", "ek.sqlite"),

  cookieName: "ek_session",
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,

  // Brute-force protection (login password + UPI PIN, dono ke liye alag counters)
  maxAttempts: 5,
  lockMs: 15 * 60 * 1000,

  // Limits (configurable; real limits bank/NPCI ke rules se aate hain)
  maxUpiTxnPaise: 100_000_00, // ₹1,00,000 per payment
  upiLite: {
    maxTxnPaise: 500_00, // ₹500 per payment (UI text se match)
    maxBalancePaise: 2_000_00, // ₹2,000 wallet cap (UI text se match)
  },
  maxDepositPaise: 50_000_00, // demo "add money" per click
  maxBudgetPaise: 1_00_00_000_00, // ₹1 crore
  goldPricePerGramPaise: 7_820_00, // static demo price

  /** HMAC pepper: DB leak hone par 4-digit PIN brute-force mushkil banata hai. */
  get pepper(): string {
    const p = process.env.EK_PEPPER;
    if (p && p.length >= 16) return p;
    if (process.env.NODE_ENV === "production") {
      throw new Error("EK_PEPPER env variable (min 16 chars) production me zaroori hai");
    }
    return "dev-only-pepper-change-me-in-production";
  },

  /** Demo-only features (jaise free "add money" deposit). Real deployment me EK_DEMO_MODE=false. */
  get demoMode(): boolean {
    return process.env.EK_DEMO_MODE !== "false";
  },

  get secureCookies(): boolean {
    return process.env.NODE_ENV === "production";
  },
};
