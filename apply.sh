#!/usr/bin/env bash
# EkPay UPI upgrade: security fixes + bank list/linking, collect, pending/failed status, complaints, forgot PIN, /upi UI.
# Run from the project root (jahan package.json hai):   bash apply.sh
set -euo pipefail

[ -f package.json ] && [ -f src/server/db.ts ] || { echo "ERROR: project root me chalao (package.json + src/server/db.ts chahiye)"; exit 1; }
command -v node >/dev/null || { echo "ERROR: node chahiye"; exit 1; }
if ! grep -q "SCHEMA_V3" src/server/db.ts || grep -q "SCHEMA_V4" src/server/db.ts; then
  echo "ERROR: ye script ORIGINAL ekpay-app-main (schema v3) ke liye bani hai."
  echo "Is folder me pehle se changes hain (ya script dobara chal rahi hai). Fresh copy ya git branch par chalao."
  exit 1
fi

BK=.ekpay-backup; mkdir -p "$BK"
backup() { [ -f "$1" ] && { mkdir -p "$BK/$(dirname "$1")"; cp "$1" "$BK/$1"; } || true; }
echo "==> Backup purani files ka: $BK/"
backup 'src/server/config.ts'
backup 'src/server/db.ts'
backup 'src/server/state.ts'
backup 'src/app/api/transactions/route.ts'
backup 'src/app/api/stations/route.ts'
backup 'src/server/ledger.ts'
backup 'src/server/payments.ts'
backup 'src/app/api/trains/route.ts'
backup 'src/app/api/lookup-number/route.ts'
backup 'tests/migration.test.ts'

# ---- patch helper: har edit exactly 1 baar match hona chahiye, warna script ruk jaati hai ----
mkdir -p "$(dirname '.ekpay-patch.mjs')"
cat > '.ekpay-patch.mjs' <<'EKPAY_EOF'
import fs from "node:fs";
const [, , file, editsFile] = process.argv;
let s = fs.readFileSync(file, "utf8");
for (const [from, to] of JSON.parse(fs.readFileSync(editsFile, "utf8"))) {
  const n = s.split(from).length - 1;
  if (n !== 1) { console.error(`PATCH FAIL ${file}: ${n} matches for: ${from.slice(0, 60)}`); process.exit(1); }
  s = s.replace(from, () => to);
}
fs.writeFileSync(file, s);
EKPAY_EOF
echo '==> Existing files patch ho rahi hain'
mkdir -p "$(dirname '.ekpay-edits.json')"
cat > '.ekpay-edits.json' <<'EKPAY_EOF'
[["  goldPricePerGramPaise: 7_820_00, // static demo price\n", "  goldPricePerGramPaise: 7_820_00, // static demo price\n\n  // UPI simulator extras\n  collectExpiryMs: 24 * 60 * 60 * 1000,\n  maxLinkedAccounts: 6,\n  /** Simulated 'pending' UPI txn itne ms baad apne aap success/failed ho jaata hai. */\n  get pendingSettleMs(): number { return Number(process.env.EK_PENDING_SETTLE_MS) || 20_000; },\n  /** Demo complaint tracking: open -> in_review -> resolved. */\n  get complaintReviewMs(): number { return Number(process.env.EK_COMPLAINT_REVIEW_MS) || 60_000; },\n  get complaintResolveMs(): number { return Number(process.env.EK_COMPLAINT_RESOLVE_MS) || 180_000; },\n  /** 'mock' = simulator (abhi). 'real' = NPCI Common Library wala RealUpiSdkService (PSP tie-up ke baad). */\n  get upiSdk(): \"mock\" | \"real\" { return process.env.EK_UPI_SDK === \"real\" ? \"real\" : \"mock\"; },\n"]]
EKPAY_EOF
node .ekpay-patch.mjs 'src/server/config.ts' .ekpay-edits.json
mkdir -p "$(dirname '.ekpay-edits.json')"
cat > '.ekpay-edits.json' <<'EKPAY_EOF'
[["export const MIGRATIONS: string[] = [SCHEMA_V1, SCHEMA_V2, SCHEMA_V3];", "/**\n * V4: UPI simulator upgrade.\n *  - transactions.status (success / pending / failed) + pending settle fields\n *  - bank_accounts.active (unlink = soft delete, kyunki purani transactions us account ko reference karti hain)\n *  - collect_requests (request money) aur complaints (dispute tracking)\n */\nconst SCHEMA_V4 = `\nALTER TABLE transactions ADD COLUMN status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','pending','failed'));\nALTER TABLE transactions ADD COLUMN settles_at INTEGER;\nALTER TABLE transactions ADD COLUMN final_status TEXT CHECK (final_status IN ('success','failed'));\nALTER TABLE transactions ADD COLUMN failure_reason TEXT;\nCREATE INDEX idx_txn_pending ON transactions(user_id, status) WHERE status = 'pending';\n\nALTER TABLE bank_accounts ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1));\nALTER TABLE bank_accounts ADD COLUMN ifsc TEXT;\n\nCREATE TABLE collect_requests (\n  id           INTEGER PRIMARY KEY AUTOINCREMENT,\n  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  payer_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),\n  note         TEXT,\n  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled','expired')),\n  created_at   INTEGER NOT NULL,\n  expires_at   INTEGER NOT NULL,\n  resolved_at  INTEGER,\n  txn_id       INTEGER REFERENCES transactions(id)\n);\nCREATE INDEX idx_collect_payer ON collect_requests(payer_id, status);\nCREATE INDEX idx_collect_requester ON collect_requests(requester_id, id DESC);\n\nCREATE TABLE complaints (\n  id          INTEGER PRIMARY KEY AUTOINCREMENT,\n  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  txn_id      INTEGER NOT NULL REFERENCES transactions(id),\n  ticket      TEXT NOT NULL UNIQUE,\n  category    TEXT NOT NULL CHECK (category IN ('debited_not_received','failed_but_debited','wrong_payee','duplicate_charge','pending_too_long','other')),\n  description TEXT NOT NULL,\n  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','rejected')),\n  resolution  TEXT,\n  created_at  INTEGER NOT NULL,\n  updated_at  INTEGER NOT NULL\n);\nCREATE UNIQUE INDEX uq_complaint_active ON complaints(txn_id) WHERE status IN ('open','in_review');\nCREATE INDEX idx_complaints_user ON complaints(user_id, id DESC);\n`;\n\nexport const MIGRATIONS: string[] = [SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4];"]]
EKPAY_EOF
node .ekpay-patch.mjs 'src/server/db.ts' .ekpay-edits.json
mkdir -p "$(dirname '.ekpay-edits.json')"
cat > '.ekpay-edits.json' <<'EKPAY_EOF'
[["import { getPrefs } from \"./settings\";", "import { getPrefs } from \"./settings\";\nimport { settlePending } from \"./settle\";"], ["  const uid = user.id;\n", "  const uid = user.id;\n  settlePending(uid);\n"], ["FROM bank_accounts WHERE user_id = ? ORDER BY is_primary DESC, id\", uid", "FROM bank_accounts WHERE user_id = ? AND active = 1 ORDER BY is_primary DESC, id\", uid"]]
EKPAY_EOF
node .ekpay-patch.mjs 'src/server/state.ts' .ekpay-edits.json
mkdir -p "$(dirname '.ekpay-edits.json')"
cat > '.ekpay-edits.json' <<'EKPAY_EOF'
[["import { ApiError } from \"../../../server/errors\";", "import { ApiError } from \"../../../server/errors\";\nimport { settlePending } from \"../../../server/settle\";"], ["  return json({ success: true, ...listTxns(user.id, { limit, before, category, q }) });", "  const st = sp.get(\"status\");\n  if (st !== null && st !== \"success\" && st !== \"pending\" && st !== \"failed\") throw new ApiError(400, \"INVALID_INPUT\", \"status success, pending ya failed hona chahiye\");\n  settlePending(user.id);\n  return json({ success: true, ...listTxns(user.id, { limit, before, category, q, status: st ?? undefined }) });"]]
EKPAY_EOF
node .ekpay-patch.mjs 'src/app/api/transactions/route.ts' .ekpay-edits.json
echo "==> stations/route.ts already updated"
rm -f .ekpay-patch.mjs .ekpay-edits.json

echo '==> Files replace ho rahi hain (security fixes, ledger, payments, migration test)'
mkdir -p "$(dirname 'src/server/ledger.ts')"
cat > 'src/server/ledger.ts' <<'EKPAY_EOF'
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
EKPAY_EOF
mkdir -p "$(dirname 'src/server/payments.ts')"
cat > 'src/server/payments.ts' <<'EKPAY_EOF'
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
EKPAY_EOF
mkdir -p "$(dirname 'src/app/api/trains/route.ts')"
cat > 'src/app/api/trains/route.ts' <<'EKPAY_EOF'
import { api, json, rateLimit } from "../../../server/http";
import { requireUser } from "../../../server/auth";

/**
 * Train search. Live data sirf tab jab RAPIDAPI_KEY env set ho. Key code me nahi hai (pehle hardcoded thi).
 * IMPORTANT: live API se fare / seat availability nahi aate, pehle formula se fake bana kar "Live" bola jaata tha.
 * Ab live result me fare/availability `null` hai, aur fallback list saaf-saaf `demo: true` ke saath aati hai.
 */
type Train = { no: string; name: string; dep: string; arr: string; dur: string; sl: number | null; a3: number | null; a2: number | null; avl: string | null };

const HOST = process.env.RAPIDAPI_IRCTC_HOST || "irctc1.p.rapidapi.com";
const CODE_RE = /^[A-Z]{1,5}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET = api(async (req) => {
  const user = requireUser(req);
  rateLimit(`trains:${user.id}`, 60, 60 * 60 * 1000);

  const sp = new URL(req.url).searchParams;
  const from = (sp.get("from") || "BPL").toUpperCase();
  const to = (sp.get("to") || "NGP").toUpperCase();
  const date = sp.get("date") || new Date().toISOString().slice(0, 10);
  if (!CODE_RE.test(from) || !CODE_RE.test(to) || !DATE_RE.test(date)) {
    return json({ success: false, error: { code: "INVALID_INPUT", message: "from/to station code aur date (YYYY-MM-DD) galat hai" } }, { status: 400 });
  }

  const key = process.env.RAPIDAPI_KEY;
  let upstreamNote = key ? "" : "RAPIDAPI_KEY set nahi hai";
  if (key) {
    try {
      const url = `https://${HOST}/api/v3/trainBetweenStations?fromStationCode=${from}&toStationCode=${to}&dateOfJourney=${date}`;
      const res = await fetch(url, {
        headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST }, cache: "no-store", signal: AbortSignal.timeout(8000),
      });
      const raw = await res.json();
      const list: Record<string, unknown>[] | null = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.data?.train_base) ? raw.data.train_base : null;
      if (res.ok && list && list.length) {
        const trains: Train[] = list.slice(0, 8).map((t) => ({
          no: String(t.train_number ?? t.trainNo ?? ""),
          name: String(t.train_name ?? t.trainName ?? ""),
          dep: String(t.from_std ?? t.departureTime ?? ""),
          arr: String(t.to_sta ?? t.arrivalTime ?? ""),
          dur: String(t.duration ?? ""),
          sl: null, a3: null, a2: null, avl: null, // is endpoint se fare/availability nahi milti
        }));
        return json({ success: true, demo: false, source: `RapidAPI (${HOST})`, fareAvailable: false, from, to, date, trains });
      }
      upstreamNote = `upstream status ${res.status}`;
    } catch {
      upstreamNote = "upstream error";
    }
  }

  // DEMO fallback: ye asli train data NAHI hai. UI par "demo" dikhana.
  const seed = (from.charCodeAt(0) * 31 + to.charCodeAt(0) * 17) % 90;
  const trains: Train[] = [
    { no: String(12600 + seed), name: `${from}-${to} Superfast Exp`, dep: "06:50", arr: "13:15", dur: "6h 25m", sl: 295 + seed, a3: 760 + seed * 2, a2: 1080 + seed * 3, avl: "AVL 46" },
    { no: "20171", name: `Vande Bharat Express (${from}-${to})`, dep: "08:15", arr: "13:40", dur: "5h 25m", sl: 840 + seed, a3: 1420 + seed * 2, a2: 2490 + seed * 3, avl: "AVL 22" },
    { no: String(19300 + (seed % 50)), name: "Dakshin Express", dep: "16:05", arr: "23:45", dur: "7h 40m", sl: 280 + seed, a3: 730 + seed * 2, a2: 1030 + seed * 3, avl: "RAC 12" },
  ];
  return json({ success: true, demo: true, source: `demo data (asli IRCTC nahi)${upstreamNote ? `: ${upstreamNote}` : ""}`, fareAvailable: true, from, to, date, trains });
});
EKPAY_EOF
mkdir -p "$(dirname 'src/app/api/lookup-number/route.ts')"
cat > 'src/app/api/lookup-number/route.ts' <<'EKPAY_EOF'
import { api, json, rateLimit } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { ApiError } from "../../../server/errors";

/**
 * Mobile number validate + operator (Numverify). Key sirf env se: PHONE_LOOKUP_API_KEY.
 * Pehle yahan key hardcoded thi aur API fail hone par "valid: true, Jio" jhooth bola jaata tha, ab nahi.
 */
export const GET = api(async (req) => {
  const user = requireUser(req);
  rateLimit(`lookup:${user.id}`, 30, 60 * 60 * 1000);

  const key = process.env.PHONE_LOOKUP_API_KEY;
  if (!key) throw new ApiError(503, "NOT_CONFIGURED", "Number lookup abhi configured nahi hai (PHONE_LOOKUP_API_KEY)");

  const digits = (new URL(req.url).searchParams.get("phone") || "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (!/^[6-9]\d{9}$/.test(last10)) throw new ApiError(400, "INVALID_PHONE", "Valid 10-digit Indian mobile number daalo");

  let data: { valid?: boolean; carrier?: string; location?: string; country_name?: string } | null = null;
  try {
    const res = await fetch(`https://api.apilayer.com/numverify/validate?number=${encodeURIComponent("+91" + last10)}`, {
      headers: { apikey: key }, cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (res.ok) data = await res.json();
  } catch { /* neeche 502 */ }
  if (!data) throw new ApiError(502, "UPSTREAM_ERROR", "Number lookup service abhi available nahi hai");

  const carrier = (data.carrier || "").toLowerCase();
  const operator =
    carrier.includes("airtel") ? "Airtel"
    : /vodafone|idea|\bvi\b/.test(carrier) ? "Vi"
    : /bsnl|mtnl/.test(carrier) ? "BSNL"
    : /jio|reliance/.test(carrier) ? "Jio"
    : null; // pehchaan nahi hui to andaza nahi lagate
  return json({
    success: true, valid: !!data.valid, operator, carrier: data.carrier || null,
    location: data.location || null, country: data.country_name || null,
  });
});
EKPAY_EOF
mkdir -p "$(dirname 'tests/migration.test.ts')"
cat > 'tests/migration.test.ts' <<'EKPAY_EOF'
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("old v1 database (gold in mg) upgrades to v2 (gold in ug) without losing data", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ek-mig-"));
  process.env.EK_DB_PATH = path.join(dir, "old.sqlite");

  const { MIGRATIONS } = await import("../src/server/db");
  const sqlite = (process as any).getBuiltinModule("node:sqlite");
  const old = new sqlite.DatabaseSync(process.env.EK_DB_PATH);
  old.exec(MIGRATIONS[0]); // sirf v1 schema
  old.exec("PRAGMA user_version = 1");
  old.exec("INSERT INTO users (phone,name,upi_id,password_hash,pin_hash,created_at) VALUES ('9000000001','Old User','9000000001@ekpay','x','y',1)");
  old.exec("INSERT INTO wallets (user_id, lite_balance_paise, gold_mg, card_due_paise, budget_paise) VALUES (1, 100, 4500, 0, 0)");
  old.close();

  const { one } = await import("../src/server/db"); // pehli query migration chala degi
  const w = one<{ gold_ug: number }>("SELECT gold_ug FROM wallets WHERE user_id = 1");
  assert.equal(w?.gold_ug, 4_500_000); // 4.5 g
  const v = one<{ user_version: number }>("PRAGMA user_version");
  assert.equal(v?.user_version, MIGRATIONS.length);

  // v3: user_settings table aa gayi, purane user ko (row nahi hai) defaults milte hain
  const t = one<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'");
  assert.equal(t?.name, "user_settings");
  const { getPrefs } = await import("../src/server/settings");
  assert.deepEqual(getPrefs(1), {
    theme: "light", soundOn: true, hideBalance: false, intlUpi: false, payAlerts: true,
  });
});

test("stale open connection (dev hot-reload) gets new migrations applied instead of 'no such table'", async () => {
  const { getDb, MIGRATIONS, one } = await import("../src/server/db");
  const g = globalThis as unknown as { __ekDb: any; __ekDbSchema?: number };
  getDb();
  // Purane server jaisa haal: connection khula, schema v3, naya code (v4) load ho chuka.
  // V4 ki cheezein hata kar wapas v3 jaisa DB bana do.
  for (const sql of [
    "DROP TABLE complaints", "DROP TABLE collect_requests", "DROP INDEX idx_txn_pending",
    "ALTER TABLE transactions DROP COLUMN status", "ALTER TABLE transactions DROP COLUMN settles_at",
    "ALTER TABLE transactions DROP COLUMN final_status", "ALTER TABLE transactions DROP COLUMN failure_reason",
    "ALTER TABLE bank_accounts DROP COLUMN active", "ALTER TABLE bank_accounts DROP COLUMN ifsc",
    "PRAGMA user_version = 3",
  ]) g.__ekDb.exec(sql);
  g.__ekDbSchema = 3;

  const { settlePending } = await import("../src/server/settle");
  assert.equal(settlePending(1), 0); // pehle yahan "no such column: status" fenkta
  assert.equal(one<{ user_version: number }>("PRAGMA user_version")?.user_version, MIGRATIONS.length);
  assert.ok(one("SELECT name FROM sqlite_master WHERE type='table' AND name='complaints'"));
});
EKPAY_EOF

echo '==> Nayi files ban rahi hain'
mkdir -p "$(dirname 'src/app/api/accounts/[id]/route.ts')"
cat > 'src/app/api/accounts/[id]/route.ts' <<'EKPAY_EOF'
import { api, json } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { unlinkAccount } from "../../../../server/linking";
import { ApiError } from "../../../../server/errors";

/** Bank account unlink (soft delete). */
export const DELETE = api(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = requireUser(req);
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(400, "INVALID_INPUT", "id invalid hai");
  return json({ success: true, ...unlinkAccount(user.id, id) });
});
EKPAY_EOF
mkdir -p "$(dirname 'src/app/api/accounts/balance/route.ts')"
cat > 'src/app/api/accounts/balance/route.ts' <<'EKPAY_EOF'
import { api, json, posInt, readJson } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { getUpiSdk } from "../../../../server/upi/sdk";

/** Balance check (PIN ke saath, jaise real UPI me). */
export const POST = api(async (req) => {
  const user = requireUser(req);
  const b = await readJson(req);
  const id = b.bankAccountId === undefined ? undefined : posInt(b.bankAccountId, "bankAccountId");
  return json({ success: true, ...(await getUpiSdk().checkBalance(user.id, id, b.pin)) });
});
EKPAY_EOF
mkdir -p "$(dirname 'src/app/api/accounts/link/route.ts')"
cat > 'src/app/api/accounts/link/route.ts' <<'EKPAY_EOF'
import { api, json, rateLimit, readJson, str } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { getUpiSdk } from "../../../../server/upi/sdk";

export const POST = api(async (req) => {
  const user = requireUser(req);
  rateLimit(`link:${user.id}`, 20, 60 * 60 * 1000);
  const b = await readJson(req);
  const account = await getUpiSdk().linkAccount(user, str(b.bankId, "bankId", 1, 80), b.last4 as string);
  return json({ success: true, account }, { status: 201 });
});
EKPAY_EOF
mkdir -p "$(dirname 'src/app/api/accounts/primary/route.ts')"
cat > 'src/app/api/accounts/primary/route.ts' <<'EKPAY_EOF'
import { api, json, posInt, readJson } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { setPrimary } from "../../../../server/linking";

export const POST = api(async (req) => {
  const user = requireUser(req);
  const b = await readJson(req);
  return json({ success: true, ...setPrimary(user.id, posInt(b.bankAccountId, "bankAccountId")) });
});
EKPAY_EOF
mkdir -p "$(dirname 'src/app/api/auth/reset-pin/route.ts')"
cat > 'src/app/api/auth/reset-pin/route.ts' <<'EKPAY_EOF'
import { api, json, readJson } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { resetPin } from "../../../../server/pin";

/** Forgot UPI PIN (simulator): account password + naya PIN. */
export const POST = api(async (req) => {
  const user = requireUser(req);
  await resetPin(user.id, await readJson(req));
  return json({ success: true });
});
EKPAY_EOF
mkdir -p "$(dirname 'src/app/api/banks/discover/route.ts')"
cat > 'src/app/api/banks/discover/route.ts' <<'EKPAY_EOF'
import { api, json, rateLimit, readJson, str } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { getUpiSdk } from "../../../../server/upi/sdk";

/** ListAccount: select ki hui bank me is mobile number se linked accounts (masked). */
export const POST = api(async (req) => {
  const user = requireUser(req);
  rateLimit(`discover:${user.id}`, 40, 60 * 60 * 1000);
  const b = await readJson(req);
  const accounts = await getUpiSdk().discoverAccounts(user, str(b.bankId, "bankId", 1, 80));
  return json({ success: true, accounts });
});
EKPAY_EOF
mkdir -p "$(dirname 'src/app/api/banks/route.ts')"
cat > 'src/app/api/banks/route.ts' <<'EKPAY_EOF'
import { api, json } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { getUpiSdk } from "../../../server/upi/sdk";

/** UPI par live banks (ListAccountProvider). `?q=` se search. Popular pehle. */
export const GET = api(async (req) => {
  requireUser(req);
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 50) || undefined;
  const banks = await getUpiSdk().getBankList(q);
  return json({ success: true, count: banks.length, banks });
});
EKPAY_EOF
mkdir -p "$(dirname 'src/app/api/collect/[id]/route.ts')"
cat > 'src/app/api/collect/[id]/route.ts' <<'EKPAY_EOF'
import { api, json, readJson } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { resolveCollect } from "../../../../server/collect";
import { ApiError } from "../../../../server/errors";

/** body: { action: "approve" | "decline" | "cancel", pin? (approve par zaroori), bankAccountId? } */
export const POST = api(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = requireUser(req);
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(400, "INVALID_INPUT", "id invalid hai");
  return json({ success: true, request: await resolveCollect(user.id, id, await readJson(req)) });
});
EKPAY_EOF
mkdir -p "$(dirname 'src/app/api/collect/route.ts')"
cat > 'src/app/api/collect/route.ts' <<'EKPAY_EOF'
import { api, json, readJson } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { createCollect, listCollect } from "../../../server/collect";

export const GET = api(async (req) => json({ success: true, ...listCollect(requireUser(req).id) }));

export const POST = api(async (req) => {
  const user = requireUser(req);
  return json({ success: true, request: createCollect(user.id, await readJson(req)) }, { status: 201 });
});
EKPAY_EOF
mkdir -p "$(dirname 'src/app/api/complaints/route.ts')"
cat > 'src/app/api/complaints/route.ts' <<'EKPAY_EOF'
import { api, json, readJson } from "../../../server/http";
import { requireUser } from "../../../server/auth";
import { createComplaint, listComplaints, COMPLAINT_CATEGORIES } from "../../../server/complaints";

export const GET = api(async (req) =>
  json({ success: true, categories: COMPLAINT_CATEGORIES, complaints: listComplaints(requireUser(req).id) }));

export const POST = api(async (req) => {
  const user = requireUser(req);
  return json({ success: true, complaint: createComplaint(user.id, await readJson(req)) }, { status: 201 });
});
EKPAY_EOF
mkdir -p "$(dirname 'src/app/api/transactions/[id]/route.ts')"
cat > 'src/app/api/transactions/[id]/route.ts' <<'EKPAY_EOF'
import { api, json } from "../../../../server/http";
import { requireUser } from "../../../../server/auth";
import { getUpiSdk } from "../../../../server/upi/sdk";
import { ApiError } from "../../../../server/errors";
import { one } from "../../../../server/db";

/** Transaction detail + live status (pending ho to settle check bhi chalta hai) + is par chal rahi complaint. */
export const GET = api(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = requireUser(req);
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(400, "INVALID_INPUT", "id invalid hai");
  const transaction = await getUpiSdk().getTransactionStatus(user.id, id);
  const complaint = one<{ ticket: string; status: string }>(
    "SELECT ticket, status FROM complaints WHERE txn_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1", id, user.id
  );
  return json({ success: true, transaction, complaint: complaint ?? null });
});
EKPAY_EOF
mkdir -p "$(dirname 'src/app/upi/page.tsx')"
cat > 'src/app/upi/page.tsx' <<'EKPAY_EOF'
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";

// UPI Hub: bank list + linking, pay/collect, history + receipt, complaints, forgot PIN.
// Sab kuch /api/* se. PIN fields sirf SIMULATOR ke liye hain. Real UPI me PIN NPCI CL ke secure UI me jaata hai.

type Res = { ok: boolean; status: number; data: any; code?: string; message: string };
async function api(method: string, url: string, body?: unknown): Promise<Res> {
  try {
    const res = await fetch(url, {
      method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.success !== false, status: res.status, data, code: data?.error?.code, message: data?.error?.message || "Kuch gadbad hui, dobara try karo" };
  } catch {
    return { ok: false, status: 0, data: {}, code: "NETWORK", message: "Network error, dobara try karo" };
  }
}
const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const key = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "k" + Date.now() + Math.random().toString(36).slice(2, 10));

const S = {
  card: { background: "var(--cd)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--ln)", borderRadius: 14, padding: 12, boxShadow: "var(--sh)", marginBottom: 10 } as const,
  input: { width: "100%", padding: "10px 12px", borderRadius: 10, borderWidth: 1, borderStyle: "solid", borderColor: "var(--ln)", background: "var(--bg)", color: "var(--tx)", font: "inherit", marginBottom: 8 } as const,
  btn: { padding: "9px 14px", borderRadius: 10, background: "var(--pr)", color: "#fff", fontWeight: 600 } as const,
  ghost: { padding: "7px 11px", borderRadius: 10, borderWidth: 1, borderStyle: "solid", borderColor: "var(--ln)", color: "var(--tx)" } as const,
  mu: { color: "var(--mu)", fontSize: 12 } as const,
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } as const,
};
const STATUS_COLOR: Record<string, string> = { success: "var(--gr)", approved: "var(--gr)", resolved: "var(--gr)", pending: "#e8a100", open: "#e8a100", in_review: "#e8a100", failed: "var(--rd)", declined: "var(--rd)", rejected: "var(--rd)", cancelled: "var(--mu)", expired: "var(--mu)" };
const Chip = ({ s }: { s: string }) => (
  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color: STATUS_COLOR[s] ?? "var(--mu)", borderWidth: 1, borderStyle: "solid", borderColor: STATUS_COLOR[s] ?? "var(--ln)" }}>{s.replace("_", " ")}</span>
);

export default function UpiHub() {
  const [tab, setTab] = useState<"banks" | "pay" | "history" | "help">("banks");
  const [me, setMe] = useState<any>(null);
  const [auth, setAuth] = useState<"loading" | "in" | "out">("loading");
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);
  const flash = (t: "ok" | "err", m: string) => setMsg({ t, m });

  const refresh = useCallback(async () => {
    const r = await api("GET", "/api/state");
    if (!r.ok) { setAuth("out"); return; }
    setMe(r.data); setAuth("in");
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  if (auth === "loading") return <div style={{ padding: 20, color: "var(--mu)" }}>Loading…</div>;
  if (auth === "out") return (
    <div style={{ padding: 20, color: "var(--tx)" }}>
      <p style={{ marginBottom: 10 }}>Pehle login karo.</p>
      <a href="/" style={{ ...S.btn, display: "inline-block" }}>Login par jao</a>
    </div>
  );

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "14px 12px 40px", color: "var(--tx)", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ ...S.row, marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>UPI Hub</div>
          <div style={S.mu}>{me.user.name} · {me.user.upiId}</div>
        </div>
        <a href="/" style={S.ghost}>Home</a>
      </div>
      <div style={{ ...S.card, background: "#fff7e0", color: "#5b4300", fontSize: 12 }}>
        Simulator: paisa sirf app ke database me move hota hai. PIN fields sirf demo ke liye hain, real UPI me PIN NPCI ke secure screen me daalte hain.
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {([["banks", "Banks"], ["pay", "Pay / Collect"], ["history", "History"], ["help", "Help"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setMsg(null); }}
            style={{ ...S.ghost, flex: 1, fontWeight: 600, ...(tab === k ? { background: "var(--pr)", color: "#fff", borderColor: "var(--pr)" } : {}) }}>{l}</button>
        ))}
      </div>
      {msg && <div role="status" style={{ ...S.card, borderColor: msg.t === "ok" ? "var(--gr)" : "var(--rd)", color: msg.t === "ok" ? "var(--gr)" : "var(--rd)" }}>{msg.m}</div>}

      {tab === "banks" && <BanksTab me={me} refresh={refresh} flash={flash} />}
      {tab === "pay" && <PayTab me={me} refresh={refresh} flash={flash} />}
      {tab === "history" && <HistoryTab flash={flash} />}
      {tab === "help" && <HelpTab flash={flash} />}
    </div>
  );
}

type TabProps = { me?: any; refresh?: () => Promise<void>; flash: (t: "ok" | "err", m: string) => void };

function BanksTab({ me, refresh, flash }: TabProps) {
  const [q, setQ] = useState("");
  const [banks, setBanks] = useState<any[]>([]);
  const [picked, setPicked] = useState<any>(null);
  const [found, setFound] = useState<any[] | null>(null);
  const [balPin, setBalPin] = useState<{ id: number; pin: string } | null>(null);
  const [balance, setBalance] = useState<Record<number, number>>({});

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await api("GET", `/api/banks?q=${encodeURIComponent(q)}`);
      if (r.ok) setBanks(r.data.banks);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const pick = async (b: any) => {
    setPicked(b); setFound(null);
    const r = await api("POST", "/api/banks/discover", { bankId: b.id });
    if (r.ok) setFound(r.data.accounts); else flash("err", r.message);
  };
  const link = async (last4: string) => {
    const r = await api("POST", "/api/accounts/link", { bankId: picked.id, last4 });
    if (r.ok) { flash("ok", `${r.data.account.label} link ho gaya`); setPicked(null); setFound(null); await refresh?.(); } else flash("err", r.message);
  };
  const unlink = async (id: number) => {
    const r = await api("DELETE", `/api/accounts/${id}`);
    if (r.ok) { flash("ok", "Account unlink ho gaya"); await refresh?.(); } else flash("err", r.message);
  };
  const primary = async (id: number) => {
    const r = await api("POST", "/api/accounts/primary", { bankAccountId: id });
    if (r.ok) { flash("ok", "Primary account badal gaya"); await refresh?.(); } else flash("err", r.message);
  };
  const checkBal = async () => {
    if (!balPin) return;
    const r = await api("POST", "/api/accounts/balance", { bankAccountId: balPin.id, pin: balPin.pin });
    if (r.ok) { setBalance((p) => ({ ...p, [balPin.id]: r.data.balance })); setBalPin(null); }
    else flash("err", r.message + (r.data?.error?.remainingAttempts !== undefined ? ` (${r.data.error.remainingAttempts} attempts bache)` : ""));
  };

  return (
    <>
      <div style={{ fontWeight: 700, margin: "4px 0 6px" }}>Linked accounts</div>
      {me.banks.map((b: any) => (
        <div key={b.id} style={S.card}>
          <div style={S.row}>
            <div><b>{b.label}</b> {b.isPrimary && <span style={{ ...S.mu, color: "var(--gr)" }}>· primary</span>}</div>
            <div>{balance[b.id] !== undefined ? <b>{inr(balance[b.id])}</b> : <span style={S.mu}>••••</span>}</div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <button style={S.ghost} onClick={() => setBalPin({ id: b.id, pin: "" })}>Check balance</button>
            {!b.isPrimary && <button style={S.ghost} onClick={() => primary(b.id)}>Make primary</button>}
            <button style={{ ...S.ghost, color: "var(--rd)" }} onClick={() => unlink(b.id)}>Unlink</button>
          </div>
          {balPin?.id === b.id && (
            <div style={{ marginTop: 8 }}>
              <input style={S.input} type="password" inputMode="numeric" maxLength={6} placeholder="Demo UPI PIN" value={balPin.pin} onChange={(e) => setBalPin({ id: b.id, pin: e.target.value.replace(/\D/g, "") })} />
              <button style={S.btn} onClick={checkBal}>Show balance</button>
            </div>
          )}
        </div>
      ))}

      <div style={{ fontWeight: 700, margin: "14px 0 6px" }}>Bank add karo ({banks.length} banks)</div>
      <input style={S.input} placeholder="Bank ka naam search karo" value={q} onChange={(e) => setQ(e.target.value)} />
      {picked && (
        <div style={S.card}>
          <div style={S.row}><b>{picked.name}</b><button style={S.ghost} onClick={() => { setPicked(null); setFound(null); }}>Band karo</button></div>
          {found === null && <div style={S.mu}>Aapke mobile number se accounts dhundh raha hu…</div>}
          {found?.length === 0 && <div style={S.mu}>Is bank me koi account nahi mila.</div>}
          {found?.map((a) => (
            <div key={a.last4} style={{ ...S.row, marginTop: 8 }}>
              <div>{a.type} · {a.maskedNumber}<div style={S.mu}>IFSC {a.ifsc}</div></div>
              <button style={S.btn} onClick={() => link(a.last4)}>Link</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {banks.map((b) => (
          <button key={b.id} onClick={() => pick(b)} style={{ ...S.card, display: "block", width: "100%", textAlign: "left", marginBottom: 6, padding: 10 }}>
            <div style={S.row}><span>{b.name}</span><span style={S.mu}>{b.popular ? "★ popular" : b.category.replace("_", " ")}</span></div>
          </button>
        ))}
        {!banks.length && <div style={S.mu}>Koi bank nahi mila.</div>}
      </div>
    </>
  );
}

function PayTab({ me, refresh, flash }: TabProps) {
  const [f, setF] = useState({ vpa: "", amount: "", pin: "", note: "", account: "" as string, simulate: "" });
  const [c, setC] = useState({ vpa: "", amount: "", note: "" });
  const [col, setCol] = useState<{ incoming: any[]; outgoing: any[] }>({ incoming: [], outgoing: [] });
  const [pins, setPins] = useState<Record<number, string>>({});

  const loadCol = useCallback(async () => {
    const r = await api("GET", "/api/collect");
    if (r.ok) setCol(r.data);
  }, []);
  useEffect(() => { void loadCol(); }, [loadCol]);

  const pay = async () => {
    const r = await api("POST", "/api/payments", {
      receiver: f.vpa.split("@")[0] || "Payee", vpa: f.vpa, amount: Number(f.amount), pin: f.pin, note: f.note || undefined,
      bankAccountId: f.account ? Number(f.account) : undefined, simulate: f.simulate || undefined, idempotencyKey: key(),
    });
    if (r.ok) {
      const t = r.data.transaction;
      flash(t.status === "failed" ? "err" : "ok", `${inr(t.amount)} · ${t.status} · UTR ${t.ref}`);
      setF({ ...f, pin: "", amount: "" }); await refresh?.();
    } else flash("err", r.message + (r.data?.error?.remainingAttempts !== undefined ? ` (${r.data.error.remainingAttempts} attempts bache)` : ""));
  };
  const collect = async () => {
    const r = await api("POST", "/api/collect", { payerVpa: c.vpa, amount: Number(c.amount), note: c.note || undefined });
    if (r.ok) { flash("ok", "Request bhej di"); setC({ vpa: "", amount: "", note: "" }); await loadCol(); } else flash("err", r.message);
  };
  const act = async (id: number, action: string) => {
    const r = await api("POST", `/api/collect/${id}`, { action, pin: pins[id] });
    if (r.ok) { flash("ok", `Request ${r.data.request.status}`); await loadCol(); await refresh?.(); }
    else flash("err", r.message + (r.data?.error?.remainingAttempts !== undefined ? ` (${r.data.error.remainingAttempts} attempts bache)` : ""));
  };

  return (
    <>
      <div style={S.card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>UPI ID par pay karo</div>
        <input style={S.input} placeholder="UPI ID (jaise 9876543210@ekpay)" value={f.vpa} onChange={(e) => setF({ ...f, vpa: e.target.value.trim() })} />
        <input style={S.input} inputMode="decimal" placeholder="Amount ₹" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <input style={S.input} placeholder="Note (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <select style={S.input} value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })}>
          <option value="">Primary account se</option>
          {me.banks.map((b: any) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <select style={S.input} value={f.simulate} onChange={(e) => setF({ ...f, simulate: e.target.value })}>
          <option value="">Normal payment</option>
          <option value="pending">Test: pending → success</option>
          <option value="deferred_failed">Test: pending → failed + refund</option>
          <option value="failed">Test: failed (paisa nahi katega)</option>
          <option value="bank_down">Test: bank server down</option>
        </select>
        <input style={S.input} type="password" inputMode="numeric" maxLength={6} placeholder="Demo UPI PIN" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, "") })} />
        <button style={S.btn} onClick={pay}>Pay</button>
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Paisa maango (collect request)</div>
        <input style={S.input} placeholder="Payer ki UPI ID" value={c.vpa} onChange={(e) => setC({ ...c, vpa: e.target.value.trim() })} />
        <input style={S.input} inputMode="decimal" placeholder="Amount ₹" value={c.amount} onChange={(e) => setC({ ...c, amount: e.target.value })} />
        <input style={S.input} placeholder="Note (optional)" value={c.note} onChange={(e) => setC({ ...c, note: e.target.value })} />
        <button style={S.btn} onClick={collect}>Request bhejo</button>
      </div>

      <div style={{ fontWeight: 700, margin: "4px 0 6px" }}>Aapse maange gaye paise</div>
      {!col.incoming.length && <div style={S.mu}>Koi request nahi.</div>}
      {col.incoming.map((r) => (
        <div key={r.id} style={S.card}>
          <div style={S.row}><div><b>{r.requester.name}</b> ne {inr(r.amount)} maange<div style={S.mu}>{r.note || r.requester.upiId}</div></div><Chip s={r.status} /></div>
          {r.status === "pending" && (
            <div style={{ marginTop: 8 }}>
              <input style={S.input} type="password" inputMode="numeric" maxLength={6} placeholder="Demo UPI PIN (approve ke liye)" value={pins[r.id] ?? ""} onChange={(e) => setPins({ ...pins, [r.id]: e.target.value.replace(/\D/g, "") })} />
              <div style={{ display: "flex", gap: 6 }}>
                <button style={S.btn} onClick={() => act(r.id, "approve")}>Approve & pay</button>
                <button style={S.ghost} onClick={() => act(r.id, "decline")}>Decline</button>
              </div>
            </div>
          )}
        </div>
      ))}
      <div style={{ fontWeight: 700, margin: "10px 0 6px" }}>Aapne maange</div>
      {!col.outgoing.length && <div style={S.mu}>Koi request nahi.</div>}
      {col.outgoing.map((r) => (
        <div key={r.id} style={S.card}>
          <div style={S.row}><div>{inr(r.amount)} · {r.payer.name}<div style={S.mu}>{r.payer.upiId}</div></div><Chip s={r.status} /></div>
          {r.status === "pending" && <button style={{ ...S.ghost, marginTop: 8 }} onClick={() => act(r.id, "cancel")}>Cancel</button>}
        </div>
      ))}
    </>
  );
}

function drawReceipt(t: any, userName: string): Promise<Blob | null> {
  const c = document.createElement("canvas");
  c.width = 600; c.height = 700;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 600, 700);
  g.fillStyle = "#d6155f"; g.fillRect(0, 0, 600, 90);
  g.fillStyle = "#fff"; g.font = "bold 30px sans-serif"; g.fillText("EkPay · Payment Receipt", 30, 56);
  g.fillStyle = t.status === "success" ? "#0f9d58" : t.status === "pending" ? "#e8a100" : "#d93025";
  g.font = "bold 28px sans-serif"; g.fillText(t.status.toUpperCase(), 30, 150);
  g.fillStyle = "#111"; g.font = "bold 44px sans-serif"; g.fillText(inr(t.amount), 30, 210);
  g.font = "22px sans-serif";
  const rows: [string, string][] = [
    [t.type === "credit" ? "From" : "To", t.counterparty], ["Account", t.bank], ["UTR / Ref", t.ref],
    ["Date", new Date(t.createdAt).toLocaleString("en-IN")], ["Type", `${t.type} · ${t.category}`], ["Account holder", userName],
    ...(t.note ? [["Note", t.note] as [string, string]] : []), ...(t.failureReason ? [["Reason", t.failureReason] as [string, string]] : []),
  ];
  rows.forEach(([k, v], i) => { g.fillStyle = "#777"; g.fillText(k, 30, 280 + i * 52); g.fillStyle = "#111"; g.fillText(String(v).slice(0, 34), 230, 280 + i * 52); });
  g.fillStyle = "#999"; g.font = "16px sans-serif"; g.fillText("Simulator receipt. Real bank transaction nahi hai.", 30, 670);
  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}

function HistoryTab({ flash }: TabProps) {
  const [filter, setFilter] = useState<"" | "success" | "pending" | "failed">("");
  const [txns, setTxns] = useState<any[]>([]);
  const [open, setOpen] = useState<any>(null);
  const [comp, setComp] = useState<{ categories: string[]; complaints: any[] }>({ categories: [], complaints: [] });
  const [form, setForm] = useState({ category: "other", description: "" });
  const [name, setName] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const r = await api("GET", `/api/transactions?limit=30${filter ? `&status=${filter}` : ""}`);
    if (r.ok) setTxns(r.data.transactions);
    const c = await api("GET", "/api/complaints");
    if (c.ok) setComp({ categories: c.data.categories, complaints: c.data.complaints });
    const m = await api("GET", "/api/auth/me");
    if (m.ok) setName(m.data.user.name);
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  // Pending txn ho to har 5 sec me status refresh
  const hasPending = txns.some((t) => t.status === "pending");
  useEffect(() => {
    if (!hasPending) return;
    timer.current = setInterval(() => { void load(); }, 5000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [hasPending, load]);

  const share = async (t: any) => {
    const blob = await drawReceipt(t, name);
    if (!blob) return flash("err", "Receipt nahi ban payi");
    const file = new File([blob], `receipt-${t.ref}.png`, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file], title: "EkPay receipt" }); return; } catch { /* cancel */ } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const raise = async () => {
    const r = await api("POST", "/api/complaints", { txnId: open.id, ...form });
    if (r.ok) { flash("ok", `Complaint darj: ${r.data.complaint.ticket}`); setForm({ category: "other", description: "" }); await load(); } else flash("err", r.message);
  };
  const ticketOf = (id: number) => comp.complaints.find((c) => c.txnId === id && (c.status === "open" || c.status === "in_review"));

  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {(["", "success", "pending", "failed"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} style={{ ...S.ghost, ...(filter === s ? { background: "var(--pr)", color: "#fff" } : {}) }}>{s || "all"}</button>
        ))}
      </div>
      {!txns.length && <div style={S.mu}>Koi transaction nahi.</div>}
      {txns.map((t) => (
        <button key={t.id} onClick={() => setOpen(t)} style={{ ...S.card, display: "block", width: "100%", textAlign: "left", marginBottom: 6, padding: 10 }}>
          <div style={S.row}>
            <div>{t.counterparty}<div style={S.mu}>{new Date(t.createdAt).toLocaleString("en-IN")}</div></div>
            <div style={{ textAlign: "right" }}><b style={{ color: t.type === "credit" ? "var(--gr)" : "var(--tx)" }}>{t.type === "credit" ? "+" : "−"}{inr(t.amount)}</b><div><Chip s={t.status} /></div></div>
          </div>
        </button>
      ))}

      {open && (
        <div style={{ ...S.card, borderColor: "var(--pr)" }}>
          <div style={S.row}><b>Transaction detail</b><button style={S.ghost} onClick={() => setOpen(null)}>Band</button></div>
          <div style={{ margin: "8px 0", lineHeight: 1.7 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{inr(open.amount)} <Chip s={open.status} /></div>
            <div>{open.type === "credit" ? "From" : "To"}: {open.counterparty}</div>
            <div>Account: {open.bank}</div>
            <div>UTR: <b>{open.ref}</b></div>
            {open.note && <div>Note: {open.note}</div>}
            {open.failureReason && <div style={{ color: "var(--rd)" }}>{open.failureReason}</div>}
          </div>
          <button style={S.btn} onClick={() => share(open)}>Receipt share / download (PNG)</button>
          <div style={{ marginTop: 12, fontWeight: 700 }}>Complaint</div>
          {ticketOf(open.id) ? (
            <div style={S.mu}>Chal rahi complaint: {ticketOf(open.id).ticket} <Chip s={ticketOf(open.id).status} /></div>
          ) : (
            <>
              <select style={S.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {comp.categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
              <textarea style={{ ...S.input, minHeight: 70 }} placeholder="Kya problem hui? (min 10 characters)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <button style={S.ghost} onClick={raise}>Complaint raise karo</button>
            </>
          )}
        </div>
      )}

      <div style={{ fontWeight: 700, margin: "14px 0 6px" }}>Meri complaints</div>
      {!comp.complaints.length && <div style={S.mu}>Koi complaint nahi.</div>}
      {comp.complaints.map((c) => (
        <div key={c.id} style={S.card}>
          <div style={S.row}><div><b>{c.ticket}</b><div style={S.mu}>{c.category.replace(/_/g, " ")} · {inr(c.transaction.amount)} · {c.transaction.counterparty}</div></div><Chip s={c.status} /></div>
          {c.resolution && <div style={{ ...S.mu, marginTop: 6 }}>{c.resolution}</div>}
        </div>
      ))}
    </>
  );
}

function HelpTab({ flash }: TabProps) {
  const [f, setF] = useState({ password: "", newPin: "" });
  const reset = async () => {
    const r = await api("POST", "/api/auth/reset-pin", f);
    if (r.ok) { flash("ok", "UPI PIN badal gaya"); setF({ password: "", newPin: "" }); } else flash("err", r.message);
  };
  return (
    <>
      <div style={S.card}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>UPI PIN bhool gaye?</div>
        <div style={{ ...S.mu, marginBottom: 8 }}>Simulator me account password se naya PIN set hota hai. Real UPI me debit card ke last 6 digits, expiry aur OTP se NPCI ke screen me hota hai.</div>
        <input style={S.input} type="password" placeholder="Account password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <input style={S.input} type="password" inputMode="numeric" maxLength={6} placeholder="Naya UPI PIN (4 ya 6 digit)" value={f.newPin} onChange={(e) => setF({ ...f, newPin: e.target.value.replace(/\D/g, "") })} />
        <button style={S.btn} onClick={reset}>PIN reset karo</button>
      </div>
      <div style={S.card}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>FAQ</div>
        <div style={{ ...S.mu, lineHeight: 1.7 }}>
          <b>Pending kya hota hai?</b> Bank ka final jawab abhi nahi aaya. Paisa hold hota hai, baad me success ya refund ho jaata hai.<br />
          <b>Paisa kata par payment failed?</b> History me us transaction ko kholo aur complaint raise karo.<br />
          <b>Collect request kitni der chalti hai?</b> 24 ghante, phir expire.
        </div>
      </div>
    </>
  );
}
EKPAY_EOF
mkdir -p "$(dirname 'src/server/banks.ts')"
cat > 'src/server/banks.ts' <<'EKPAY_EOF'
import fs from "node:fs";
import path from "node:path";

export type BankCategory = "public" | "private" | "small_finance" | "payments" | "foreign" | "rural" | "cooperative";
export interface Bank { id: string; name: string; category: BankCategory; popular: boolean }

/**
 * SEED LIST: UPI par live banks ka ek bada subset, par NPCI ki poori (300+) list nahi.
 * Poori list ke liye NPCI ki "UPI Live Members" list download karke `data/upi-banks.json` me rakh do
 * (format: [{ "id": "hdfc", "name": "HDFC Bank", "category": "private", "popular": true }, ...]).
 * Wo file milte hi ye seed list ignore ho jaati hai. PSP ke saath real SDK aane par
 * ListAccountProvider API se yahi list aayegi (upi/sdk.ts).
 * IIN / account-provider codes yahan jaan-boojh kar nahi hain: wo NPCI ki list se hi lena, andaza mat lagana.
 */
const SEED: [string, BankCategory, boolean?][] = [
  // Popular
  ["State Bank of India", "public", true], ["HDFC Bank", "private", true], ["ICICI Bank", "private", true],
  ["Axis Bank", "private", true], ["Kotak Mahindra Bank", "private", true], ["Punjab National Bank", "public", true],
  ["Bank of Baroda", "public", true], ["Canara Bank", "public", true], ["Union Bank of India", "public", true],
  ["Yes Bank", "private", true], ["IDFC FIRST Bank", "private", true], ["Paytm Payments Bank", "payments", true],
  // Public sector
  ["Bank of India", "public"], ["Indian Bank", "public"], ["Central Bank of India", "public"],
  ["Indian Overseas Bank", "public"], ["UCO Bank", "public"], ["Bank of Maharashtra", "public"],
  ["Punjab & Sind Bank", "public"],
  // Private
  ["IndusInd Bank", "private"], ["Federal Bank", "private"], ["IDBI Bank", "private"], ["South Indian Bank", "private"],
  ["Karnataka Bank", "private"], ["Karur Vysya Bank", "private"], ["City Union Bank", "private"],
  ["Tamilnad Mercantile Bank", "private"], ["RBL Bank", "private"], ["Bandhan Bank", "private"], ["DCB Bank", "private"],
  ["CSB Bank", "private"], ["Dhanlaxmi Bank", "private"], ["Jammu & Kashmir Bank", "private"], ["Nainital Bank", "private"],
  ["IDBI Intesa", "private"],
  // Small finance
  ["AU Small Finance Bank", "small_finance"], ["Equitas Small Finance Bank", "small_finance"],
  ["Ujjivan Small Finance Bank", "small_finance"], ["Jana Small Finance Bank", "small_finance"],
  ["Suryoday Small Finance Bank", "small_finance"], ["ESAF Small Finance Bank", "small_finance"],
  ["Utkarsh Small Finance Bank", "small_finance"], ["Capital Small Finance Bank", "small_finance"],
  ["North East Small Finance Bank", "small_finance"], ["Fincare Small Finance Bank", "small_finance"],
  ["Shivalik Small Finance Bank", "small_finance"], ["Unity Small Finance Bank", "small_finance"],
  // Payments banks
  ["Airtel Payments Bank", "payments"], ["India Post Payments Bank", "payments"], ["Fino Payments Bank", "payments"],
  ["Jio Payments Bank", "payments"], ["NSDL Payments Bank", "payments"],
  // Foreign
  ["Standard Chartered Bank", "foreign"], ["HSBC", "foreign"], ["Citibank", "foreign"], ["DBS Bank India", "foreign"],
  ["Deutsche Bank", "foreign"],
  // Regional rural
  ["Madhya Pradesh Gramin Bank", "rural"], ["Karnataka Gramin Bank", "rural"], ["Kerala Gramin Bank", "rural"],
  ["Tamil Nadu Grama Bank", "rural"], ["Telangana Grameena Bank", "rural"], ["Andhra Pradesh Grameena Vikas Bank", "rural"],
  ["Chhattisgarh Rajya Gramin Bank", "rural"], ["Jharkhand Rajya Gramin Bank", "rural"], ["Himachal Pradesh Gramin Bank", "rural"],
  ["Punjab Gramin Bank", "rural"], ["Assam Gramin Vikash Bank", "rural"], ["Maharashtra Gramin Bank", "rural"],
  ["Utkal Grameen Bank", "rural"], ["Odisha Gramya Bank", "rural"], ["Uttar Bihar Gramin Bank", "rural"],
  ["Dakshin Bihar Gramin Bank", "rural"], ["Baroda UP Bank", "rural"], ["Prathama UP Gramin Bank", "rural"],
  ["Aryavart Bank", "rural"], ["Saptagiri Grameena Bank", "rural"],
  // Co-operative
  ["Saraswat Co-operative Bank", "cooperative"], ["Cosmos Co-operative Bank", "cooperative"], ["TJSB Sahakari Bank", "cooperative"],
  ["Bharat Co-operative Bank", "cooperative"], ["Abhyudaya Co-operative Bank", "cooperative"], ["NKGSB Co-operative Bank", "cooperative"],
  ["SVC Co-operative Bank", "cooperative"], ["Janata Sahakari Bank", "cooperative"], ["Kalupur Commercial Co-operative Bank", "cooperative"],
  ["Nutan Nagarik Sahakari Bank", "cooperative"], ["Mehsana Urban Co-operative Bank", "cooperative"], ["Apna Sahakari Bank", "cooperative"],
  ["Thane Bharat Sahakari Bank", "cooperative"], ["Rajkot Nagarik Sahakari Bank", "cooperative"], ["Ahmedabad Mercantile Co-operative Bank", "cooperative"],
];

const slug = (n: string) => n.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

let cache: { key: string; list: Bank[] } | null = null;

function fromFile(): Bank[] | null {
  const file = process.env.EK_BANKS_FILE || path.join(process.cwd(), "data", "upi-banks.json");
  try {
    const stat = fs.statSync(file);
    const key = `${file}:${stat.mtimeMs}`;
    if (cache?.key === key) return cache.list;
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (!Array.isArray(raw)) return null;
    const cats: string[] = ["public", "private", "small_finance", "payments", "foreign", "rural", "cooperative"];
    const list: Bank[] = [];
    for (const r of raw as Record<string, unknown>[]) {
      if (typeof r?.name !== "string" || !r.name.trim()) continue;
      const name = r.name.trim().slice(0, 80);
      list.push({
        id: typeof r.id === "string" && /^[a-z0-9-]{1,60}$/.test(r.id) ? r.id : slug(name),
        name,
        category: (cats.includes(String(r.category)) ? r.category : "private") as BankCategory,
        popular: r.popular === true,
      });
    }
    if (!list.length) return null;
    cache = { key, list };
    return list;
  } catch {
    return null;
  }
}

const seedList = (): Bank[] => SEED.map(([name, category, popular]) => ({ id: slug(name), name, category, popular: !!popular }));

/** Popular pehle, baaki alphabetical. `q` se naam me search. */
export function listBanks(q?: string): Bank[] {
  let list = fromFile() ?? seedList();
  const needle = q?.trim().toLowerCase();
  if (needle) list = list.filter((b) => b.name.toLowerCase().includes(needle) || b.id.includes(needle));
  return [...list].sort((a, b) => Number(b.popular) - Number(a.popular) || a.name.localeCompare(b.name));
}

export const getBank = (id: string): Bank | undefined => (fromFile() ?? seedList()).find((b) => b.id === id);
EKPAY_EOF
mkdir -p "$(dirname 'src/server/collect.ts')"
cat > 'src/server/collect.ts' <<'EKPAY_EOF'
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
EKPAY_EOF
mkdir -p "$(dirname 'src/server/complaints.ts')"
cat > 'src/server/complaints.ts' <<'EKPAY_EOF'
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
EKPAY_EOF
mkdir -p "$(dirname 'src/server/linking.ts')"
cat > 'src/server/linking.ts' <<'EKPAY_EOF'
import { config } from "./config";
import { ApiError } from "./errors";
import { many, one, transaction } from "./db";
import { sha256 } from "./security";
import { getBank } from "./banks";
import { getAccount } from "./ledger";
import { verifyPin } from "./auth";
import { rupees } from "./money";
import type { SessionUser } from "./auth";

export interface DiscoveredAccount { last4: string; type: "Savings" | "Current"; maskedNumber: string; ifsc: string }

/**
 * MOCK ListAccount API: user ke mobile number + bank se deterministic accounts banata hai.
 * Real me ye NPCI -> bank se aata hai (upi/sdk.ts ka RealUpiSdkService). Client apna last4 nahi bana sakta,
 * link karte waqt hum yahi list dobara bana kar match karte hain.
 */
export function mockDiscover(phone: string, bankId: string): DiscoveredAccount[] {
  const bank = getBank(bankId);
  if (!bank) throw new ApiError(404, "BANK_NOT_FOUND", "Ye bank list me nahi hai");
  const h = sha256(`${phone}:${bankId}`);
  const n = (i: number) => String(parseInt(h.slice(i, i + 6), 16) % 10000).padStart(4, "0");
  const code = bank.name.replace(/[^A-Za-z]/g, "").toUpperCase().padEnd(4, "X").slice(0, 4);
  const ifsc = `${code}0${String(parseInt(h.slice(20, 26), 16) % 1_000_000).padStart(6, "0")}`;
  const out: DiscoveredAccount[] = [{ last4: n(0), type: "Savings", maskedNumber: `XXXXXX${n(0)}`, ifsc }];
  if (parseInt(h[30], 16) % 3 === 0) {
    const l2 = n(8) === n(0) ? "0001" : n(8);
    out.push({ last4: l2, type: "Current", maskedNumber: `XXXXXX${l2}`, ifsc });
  }
  return out;
}

/** Mock opening balance (sirf simulator). Real me bank se balance PIN ke saath fetch hota hai. */
const mockBalancePaise = (phone: string, bankId: string, last4: string) =>
  (parseInt(sha256(`${phone}:${bankId}:${last4}:bal`).slice(0, 6), 16) % 49_000 + 1_000) * 100;

export function mockLink(user: SessionUser, bankId: string, last4: unknown) {
  if (typeof last4 !== "string" || !/^\d{4}$/.test(last4)) throw new ApiError(400, "INVALID_INPUT", "last4 4 digits ka hona chahiye");
  const bank = getBank(bankId);
  if (!bank) throw new ApiError(404, "BANK_NOT_FOUND", "Ye bank list me nahi hai");
  const found = mockDiscover(user.phone, bankId).find((a) => a.last4 === last4);
  if (!found) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Is mobile number se is bank me ye account linked nahi mila");

  return transaction((db) => {
    const existing = db
      .prepare("SELECT id, active FROM bank_accounts WHERE user_id = ? AND bank_name = ? AND last4 = ?")
      .get(user.id, bank.name, last4) as { id: number; active: number } | undefined;
    if (existing?.active === 1) throw new ApiError(409, "ALREADY_LINKED", "Ye account pehle se linked hai");

    const activeCount = Number((db.prepare("SELECT COUNT(*) AS c FROM bank_accounts WHERE user_id = ? AND active = 1").get(user.id) as { c: number }).c);
    if (activeCount >= config.maxLinkedAccounts) {
      throw new ApiError(409, "TOO_MANY_ACCOUNTS", `Max ${config.maxLinkedAccounts} accounts hi link ho sakte hain`);
    }
    const hasPrimary = activeCount > 0 && !!db.prepare("SELECT 1 FROM bank_accounts WHERE user_id = ? AND active = 1 AND is_primary = 1").get(user.id);

    let id: number;
    if (existing) {
      // Pehle unlink kiya tha: wahi account wapas (balance bhi wahi, paisa mint nahi hota).
      db.prepare("UPDATE bank_accounts SET active = 1, is_primary = ? WHERE id = ?").run(hasPrimary ? 0 : 1, existing.id);
      id = existing.id;
    } else {
      const res = db
        .prepare("INSERT INTO bank_accounts (user_id, bank_name, last4, balance_paise, is_primary, created_at, ifsc) VALUES (?,?,?,?,?,?,?)")
        .run(user.id, bank.name, last4, mockBalancePaise(user.phone, bankId, last4), hasPrimary ? 0 : 1, Date.now(), found.ifsc);
      id = Number(res.lastInsertRowid);
    }
    return { id, label: `${bank.name} ••${last4}`, isPrimary: !hasPrimary };
  });
}

/** Unlink: soft delete. Aakhri active account unlink nahi hota. Primary hata to koi aur primary ban jaata hai. */
export function unlinkAccount(userId: number, accountId: number) {
  return transaction((db) => {
    const acc = db.prepare("SELECT id, is_primary FROM bank_accounts WHERE id = ? AND user_id = ? AND active = 1").get(accountId, userId) as
      | { id: number; is_primary: number } | undefined;
    if (!acc) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Bank account nahi mila");
    const left = db.prepare("SELECT id FROM bank_accounts WHERE user_id = ? AND active = 1 AND id != ? ORDER BY id").all(userId, accountId) as { id: number }[];
    if (!left.length) throw new ApiError(409, "LAST_ACCOUNT", "Aakhri bank account unlink nahi ho sakta");
    db.prepare("UPDATE bank_accounts SET active = 0, is_primary = 0 WHERE id = ?").run(accountId);
    if (acc.is_primary) db.prepare("UPDATE bank_accounts SET is_primary = 1 WHERE id = ?").run(left[0].id);
    return { removed: accountId, newPrimaryId: acc.is_primary ? left[0].id : null };
  });
}

export function setPrimary(userId: number, accountId: number) {
  transaction((db) => {
    getAccount(db, userId, accountId); // ownership + active check
    db.prepare("UPDATE bank_accounts SET is_primary = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE user_id = ? AND active = 1").run(accountId, userId);
  });
  return { primaryId: accountId };
}

/** Balance check: real UPI me bhi PIN lagta hai. Yahan simulator PIN verify (lockout rules ke saath). */
export async function mockBalance(userId: number, accountId: number | undefined, pin: unknown) {
  await verifyPin(userId, pin);
  const row = one<{ bank_name: string; last4: string; balance_paise: number }>(
    accountId
      ? "SELECT bank_name, last4, balance_paise FROM bank_accounts WHERE id = ? AND user_id = ? AND active = 1"
      : "SELECT bank_name, last4, balance_paise FROM bank_accounts WHERE user_id = ? AND active = 1 ORDER BY is_primary DESC, id LIMIT 1",
    ...(accountId ? [accountId, userId] : [userId])
  );
  if (!row) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Bank account nahi mila");
  return { label: `${row.bank_name} ••${row.last4}`, balance: rupees(row.balance_paise) };
}

export const linkedAccounts = (userId: number) =>
  many("SELECT id, bank_name, last4, is_primary FROM bank_accounts WHERE user_id = ? AND active = 1 ORDER BY is_primary DESC, id", userId);
EKPAY_EOF
mkdir -p "$(dirname 'src/server/pin.ts')"
cat > 'src/server/pin.ts' <<'EKPAY_EOF'
import { ApiError } from "./errors";
import { one, run } from "./db";
import { hashSecret, serialize, verifySecret } from "./security";
import { clearAttempts, registerFailure, reserveAttempt } from "./attempts";

const PIN_RE = /^\d{4}(\d{2})?$/;

/**
 * Forgot UPI PIN (simulator): account password se verify karke naya PIN set.
 * Real UPI me ye debit card ke last 6 digits + expiry + OTP se NPCI CL ke andar hota hai.
 * Password galat hone par login wale hi lockout counters lagte hain. Sahi hone par PIN lock bhi hat jaata hai.
 */
export async function resetPin(userId: number, body: Record<string, unknown>) {
  const next = typeof body.newPin === "string" ? body.newPin : "";
  if (!PIN_RE.test(next)) throw new ApiError(400, "INVALID_PIN_FORMAT", "Naya UPI PIN 4 ya 6 digits ka hona chahiye");
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 1 || password.length > 128) throw new ApiError(400, "INVALID_INPUT", "password chahiye");

  await serialize(`login:${userId}`, async () => {
    reserveAttempt(userId, "login");
    const u = one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", userId);
    if (!u || !(await verifySecret(password, u.password_hash))) {
      registerFailure(userId, "login");
      throw new ApiError(401, "INVALID_CREDENTIALS", "Password galat hai");
    }
    clearAttempts(userId, "login");
  });
  const hash = await hashSecret(next);
  run("UPDATE users SET pin_hash = ?, pin_failures = 0, pin_locked_until = 0 WHERE id = ?", hash, userId);
}
EKPAY_EOF
mkdir -p "$(dirname 'src/server/settle.ts')"
cat > 'src/server/settle.ts' <<'EKPAY_EOF'
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
EKPAY_EOF
mkdir -p "$(dirname 'src/server/upi/sdk.ts')"
cat > 'src/server/upi/sdk.ts' <<'EKPAY_EOF'
import { config } from "../config";
import { ApiError } from "../errors";
import type { SessionUser } from "../auth";
import { listBanks, type Bank } from "../banks";
import { mockBalance, mockDiscover, mockLink, type DiscoveredAccount } from "../linking";
import { findTxnById, mapTxn } from "../ledger";
import { settlePending } from "../settle";

/**
 * NPCI Common Library / PSP ke saath jo bhi cheezein bahar se aati hain, sab is ek interface ke peeche.
 * Abhi `MockUpiSdkService` chalta hai. PSP sandbox + NPCI CL milne par sirf `RealUpiSdkService` bharna hai
 * aur env me EK_UPI_SDK=real karna hai, baaki app (routes, UI) ko haath nahi lagana padega.
 *
 * Dhyan: real UPI me UPI PIN kabhi hamare server/app tak nahi aata, wo sirf NPCI CL ke secure UI me jaata hai.
 * Mock me PIN hamare server par verify hota hai, ye sirf simulator ke liye hai.
 */
export interface UpiSdkService {
  /** ListAccountProvider */
  getBankList(q?: string): Promise<Bank[]>;
  /** ListAccount: user ke mobile number se bank me kaun-kaun se accounts linked hain */
  discoverAccounts(user: SessionUser, bankId: string): Promise<DiscoveredAccount[]>;
  linkAccount(user: SessionUser, bankId: string, last4: string): Promise<{ id: number; label: string; isPrimary: boolean }>;
  /** Real me PIN CL ke UI me enter hota hai; `pin` sirf mock me use hota hai. */
  checkBalance(userId: number, accountId: number | undefined, pin: unknown): Promise<{ label: string; balance: number }>;
  getTransactionStatus(userId: number, txnId: number): Promise<ReturnType<typeof mapTxn>>;
}

export class MockUpiSdkService implements UpiSdkService {
  async getBankList(q?: string) { return listBanks(q); }
  async discoverAccounts(user: SessionUser, bankId: string) { return mockDiscover(user.phone, bankId); }
  async linkAccount(user: SessionUser, bankId: string, last4: string) { return mockLink(user, bankId, last4); }
  async checkBalance(userId: number, accountId: number | undefined, pin: unknown) { return mockBalance(userId, accountId, pin); }
  async getTransactionStatus(userId: number, txnId: number) {
    settlePending(userId);
    const t = findTxnById(userId, txnId);
    if (!t) throw new ApiError(404, "TXN_NOT_FOUND", "Transaction nahi mili");
    return mapTxn(t);
  }
}

const notReady = (what: string) =>
  new ApiError(501, "SDK_NOT_CONFIGURED", `Real UPI SDK abhi connected nahi hai (${what}). PSP bank + NPCI CL integration baaki hai.`);

/** TODO: PSP bank se NPCI CL / sandbox credentials milne par yahan real calls likhna. */
export class RealUpiSdkService implements UpiSdkService {
  async getBankList(): Promise<Bank[]> { throw notReady("ListAccountProvider"); }
  async discoverAccounts(): Promise<DiscoveredAccount[]> { throw notReady("ListAccount"); }
  async linkAccount(): Promise<never> { throw notReady("link account"); }
  async checkBalance(): Promise<never> { throw notReady("balance enquiry via CL"); }
  async getTransactionStatus(): Promise<never> { throw notReady("transaction status / check txn API"); }
}

export const getUpiSdk = (): UpiSdkService => (config.upiSdk === "real" ? new RealUpiSdkService() : new MockUpiSdkService());
EKPAY_EOF
mkdir -p "$(dirname 'tests/upi.test.ts')"
cat > 'tests/upi.test.ts' <<'EKPAY_EOF'
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ek-upi-test-"));
process.env.EK_DB_PATH = path.join(tmp, "test.sqlite");
process.env.EK_PENDING_SETTLE_MS = "300";
process.env.EK_COMPLAINT_REVIEW_MS = "150";
process.env.EK_COMPLAINT_RESOLVE_MS = "400";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Route = Record<string, (req: Request, ctx?: any) => Promise<Response>>;
const R: Record<string, Route> = {};
let ip = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(route: string, method: string, url: string, o: { body?: unknown; cookie?: string; ctx?: any } = {}) {
  const headers: Record<string, string> = { "x-forwarded-for": `10.1.0.${++ip}` };
  if (o.body !== undefined) headers["content-type"] = "application/json";
  if (o.cookie) headers.cookie = o.cookie;
  const req = new Request("http://localhost:3000" + url, { method, headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
  const res = await R[route][method](req, o.ctx);
  return { status: res.status, data: (await res.json()) as any };
}
const idCtx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

let seq = 9500000000;
async function newUser(name = "Test User") {
  const phone = String(++seq);
  const r = await fetchRegister(phone, name);
  const st = await call("state", "GET", "/api/state", { cookie: r.cookie });
  return { phone, cookie: r.cookie, upiId: `${phone}@ekpay`, name, banks: st.data.banks as any[], hdfc: st.data.banks[0].id as number };
}
async function fetchRegister(phone: string, name: string) {
  const req = new Request("http://localhost:3000/api/auth/register", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.2.0.${++ip}` },
    body: JSON.stringify({ phone, name, password: "StrongPass123", upiPin: "1234" }),
  });
  const res = await R.register.POST(req);
  assert.equal(res.status, 201);
  return { cookie: res.headers.get("set-cookie")!.split(";")[0] };
}
const state = async (c: string) => (await call("state", "GET", "/api/state", { cookie: c })).data;
const pay = (cookie: string, body: Record<string, unknown>) =>
  call("payments", "POST", "/api/payments", { cookie, body: { receiver: "Shop", pin: "1234", ...body } });
const balanceOf = async (c: string, id: number) => (await state(c)).banks.find((b: any) => b.id === id).balance as number;

before(async () => {
  const load = async (n: string, p: string) => (R[n] = (await import(p)) as Route);
  await load("register", "../src/app/api/auth/register/route");
  await load("state", "../src/app/api/state/route");
  await load("payments", "../src/app/api/payments/route");
  await load("txns", "../src/app/api/transactions/route");
  await load("txnId", "../src/app/api/transactions/[id]/route");
  await load("banks", "../src/app/api/banks/route");
  await load("discover", "../src/app/api/banks/discover/route");
  await load("link", "../src/app/api/accounts/link/route");
  await load("acc", "../src/app/api/accounts/[id]/route");
  await load("primary", "../src/app/api/accounts/primary/route");
  await load("balance", "../src/app/api/accounts/balance/route");
  await load("collect", "../src/app/api/collect/route");
  await load("collectId", "../src/app/api/collect/[id]/route");
  await load("complaints", "../src/app/api/complaints/route");
  await load("resetPin", "../src/app/api/auth/reset-pin/route");
  await load("login", "../src/app/api/auth/login/route");
  await load("trains", "../src/app/api/trains/route");
  await load("stations", "../src/app/api/stations/route");
  await load("lookup", "../src/app/api/lookup-number/route");
});

describe("bank list", () => {
  test("login zaroori, popular upar, search, categories", async () => {
    assert.equal((await call("banks", "GET", "/api/banks")).status, 401);
    const u = await newUser();
    const all = await call("banks", "GET", "/api/banks", { cookie: u.cookie });
    assert.ok(all.data.count > 80);
    assert.equal(all.data.banks[0].popular, true);
    const cats = new Set(all.data.banks.map((b: any) => b.category));
    for (const c of ["public", "private", "small_finance", "payments", "rural", "cooperative"]) assert.ok(cats.has(c), c);
    const q = await call("banks", "GET", "/api/banks?q=gramin", { cookie: u.cookie });
    assert.ok(q.data.banks.length > 3 && q.data.banks.every((b: any) => /gramin/i.test(b.name)));
  });
});

describe("account linking", () => {
  test("discover -> link, fake last4 reject, duplicate reject, deterministic", async () => {
    const u = await newUser();
    const d1 = await call("discover", "POST", "/api/banks/discover", { cookie: u.cookie, body: { bankId: "axis-bank" } });
    const d2 = await call("discover", "POST", "/api/banks/discover", { cookie: u.cookie, body: { bankId: "axis-bank" } });
    assert.equal(d1.status, 200);
    assert.deepEqual(d1.data.accounts, d2.data.accounts);
    assert.match(d1.data.accounts[0].maskedNumber, /^X+\d{4}$/);
    assert.equal((await call("discover", "POST", "/api/banks/discover", { cookie: u.cookie, body: { bankId: "no-such-bank" } })).status, 404);

    const fake = d1.data.accounts[0].last4 === "0000" ? "1111" : "0000";
    assert.equal((await call("link", "POST", "/api/accounts/link", { cookie: u.cookie, body: { bankId: "axis-bank", last4: fake } })).status, 404);

    const ok = await call("link", "POST", "/api/accounts/link", { cookie: u.cookie, body: { bankId: "axis-bank", last4: d1.data.accounts[0].last4 } });
    assert.equal(ok.status, 201);
    assert.equal(ok.data.account.isPrimary, false); // pehle se primary hai
    assert.equal((await call("link", "POST", "/api/accounts/link", { cookie: u.cookie, body: { bankId: "axis-bank", last4: d1.data.accounts[0].last4 } })).status, 409);
    assert.equal((await state(u.cookie)).banks.length, 4);
  });

  test("linked account se payment ho sakti hai, primary badalna, unlink + relink balance same", async () => {
    const u = await newUser();
    const d = await call("discover", "POST", "/api/banks/discover", { cookie: u.cookie, body: { bankId: "federal-bank" } });
    const l = await call("link", "POST", "/api/accounts/link", { cookie: u.cookie, body: { bankId: "federal-bank", last4: d.data.accounts[0].last4 } });
    const id = l.data.account.id;
    const bal = await balanceOf(u.cookie, id);
    assert.ok(bal >= 1000);
    assert.equal((await pay(u.cookie, { amount: 10, bankAccountId: id })).status, 201);
    assert.equal(await balanceOf(u.cookie, id), bal - 10);

    assert.equal((await call("primary", "POST", "/api/accounts/primary", { cookie: u.cookie, body: { bankAccountId: id } })).status, 200);
    const s = await state(u.cookie);
    assert.equal(s.banks[0].id, id);
    assert.equal(s.banks.filter((b: any) => b.isPrimary).length, 1);

    // primary unlink -> koi aur primary ban jaata hai, history safe
    const un = await call("acc", "DELETE", `/api/accounts/${id}`, { cookie: u.cookie, ctx: idCtx(id) });
    assert.equal(un.status, 200);
    assert.ok(un.data.newPrimaryId);
    const s2 = await state(u.cookie);
    assert.equal(s2.banks.length, 3);
    assert.equal(s2.banks.filter((b: any) => b.isPrimary).length, 1);
    assert.equal((await pay(u.cookie, { amount: 1, bankAccountId: id })).status, 404); // unlink account se pay nahi
    assert.equal((await state(u.cookie)).recentTransactions.length > 0, true);

    // relink: wahi balance (paisa mint nahi hota)
    const re = await call("link", "POST", "/api/accounts/link", { cookie: u.cookie, body: { bankId: "federal-bank", last4: d.data.accounts[0].last4 } });
    assert.equal(re.data.account.id, id);
    assert.equal(await balanceOf(u.cookie, id), bal - 10);
  });

  test("aakhri account unlink nahi, dusre ka account chhu nahi sakte", async () => {
    const a = await newUser(), b = await newUser();
    const other = await call("acc", "DELETE", `/api/accounts/${b.hdfc}`, { cookie: a.cookie, ctx: idCtx(b.hdfc) });
    assert.equal(other.status, 404);
    assert.equal((await call("primary", "POST", "/api/accounts/primary", { cookie: a.cookie, body: { bankAccountId: b.hdfc } })).status, 404);
    for (const bk of a.banks.slice(1)) assert.equal((await call("acc", "DELETE", `/api/accounts/${bk.id}`, { cookie: a.cookie, ctx: idCtx(bk.id) })).status, 200);
    const last = await call("acc", "DELETE", `/api/accounts/${a.banks[0].id}`, { cookie: a.cookie, ctx: idCtx(a.banks[0].id) });
    assert.equal(last.status, 409);
    assert.equal(last.data.error.code, "LAST_ACCOUNT");
  });

  test("max linked accounts", async () => {
    const u = await newUser();
    let linked = 0, last = 0;
    for (const bank of ["axis-bank", "yes-bank", "idfc-first-bank", "bank-of-baroda", "canara-bank", "indusind-bank", "federal-bank", "karnataka-bank"]) {
      const d = await call("discover", "POST", "/api/banks/discover", { cookie: u.cookie, body: { bankId: bank } });
      const r = await call("link", "POST", "/api/accounts/link", { cookie: u.cookie, body: { bankId: bank, last4: d.data.accounts[0].last4 } });
      if (r.status === 201) linked++; else last = r.status;
    }
    assert.equal(linked, 3); // 3 demo + 3 = 6
    assert.equal(last, 409);
  });
});

describe("balance check + forgot PIN", () => {
  test("balance PIN ke bina nahi, galat PIN 401", async () => {
    const u = await newUser();
    assert.equal((await call("balance", "POST", "/api/accounts/balance", { cookie: u.cookie, body: { bankAccountId: u.hdfc, pin: "9999" } })).status, 401);
    const ok = await call("balance", "POST", "/api/accounts/balance", { cookie: u.cookie, body: { bankAccountId: u.hdfc, pin: "1234" } });
    assert.equal(ok.data.balance, 48230);
    assert.equal((await call("balance", "POST", "/api/accounts/balance", { body: { pin: "1234" } })).status, 401);
  });

  test("forgot PIN: galat password reject, sahi password se naya PIN, lock bhi hat jaata hai", async () => {
    const u = await newUser();
    for (let i = 0; i < 5; i++) await call("balance", "POST", "/api/accounts/balance", { cookie: u.cookie, body: { pin: "0000" } });
    assert.equal((await call("balance", "POST", "/api/accounts/balance", { cookie: u.cookie, body: { pin: "1234" } })).status, 423); // PIN locked

    assert.equal((await call("resetPin", "POST", "/api/auth/reset-pin", { cookie: u.cookie, body: { password: "WrongPass999", newPin: "4321" } })).status, 401);
    assert.equal((await call("resetPin", "POST", "/api/auth/reset-pin", { cookie: u.cookie, body: { password: "StrongPass123", newPin: "12" } })).status, 400);
    assert.equal((await call("resetPin", "POST", "/api/auth/reset-pin", { cookie: u.cookie, body: { password: "StrongPass123", newPin: "4321" } })).status, 200);

    assert.equal((await call("balance", "POST", "/api/accounts/balance", { cookie: u.cookie, body: { pin: "1234" } })).status, 401); // purana PIN band
    assert.equal((await call("balance", "POST", "/api/accounts/balance", { cookie: u.cookie, body: { pin: "4321" } })).status, 200);
    assert.equal((await call("resetPin", "POST", "/api/auth/reset-pin", { body: { password: "StrongPass123", newPin: "4321" } })).status, 401);
  });
});

describe("payments: receiver credit + simulated outcomes", () => {
  test("registered receiver ko credit milta hai, bahar wale ko nahi", async () => {
    const a = await newUser("Alice Sender"), b = await newUser("Bob Receiver");
    const bBefore = await balanceOf(b.cookie, b.hdfc);
    assert.equal((await pay(a.cookie, { amount: 250.5, vpa: b.upiId })).status, 201);
    assert.equal(await balanceOf(b.cookie, b.hdfc), bBefore + 250.5);
    const sent = (await state(a.cookie)).recentTransactions[0];
    assert.equal(sent.counterparty, "Bob Receiver"); // pay() me receiver="Shop" tha, par asli naam dikhta hai (spoof nahi)
    const rx = (await state(b.cookie)).recentTransactions[0];
    assert.equal(rx.type, "credit"); assert.equal(rx.counterparty, "Alice Sender"); assert.equal(rx.status, "success");

    const before = await balanceOf(a.cookie, a.hdfc);
    assert.equal((await pay(a.cookie, { amount: 5, vpa: "someone@okhdfc" })).status, 201);
    assert.equal(await balanceOf(a.cookie, a.hdfc), before - 5);
  });

  test("simulate failed: paisa nahi kata, status failed", async () => {
    const u = await newUser();
    const r = await pay(u.cookie, { amount: 100, simulate: "failed" });
    assert.equal(r.status, 201);
    assert.equal(r.data.transaction.status, "failed");
    assert.equal(await balanceOf(u.cookie, u.hdfc), 48230);
  });

  test("simulate bank_down: 503 aur koi entry nahi", async () => {
    const u = await newUser();
    const n = (await call("txns", "GET", "/api/transactions", { cookie: u.cookie })).data.transactions.length;
    const r = await pay(u.cookie, { amount: 100, simulate: "bank_down" });
    assert.equal(r.status, 503); assert.equal(r.data.error.code, "BANK_DOWN");
    assert.equal((await call("txns", "GET", "/api/transactions", { cookie: u.cookie })).data.transactions.length, n);
    assert.equal(await balanceOf(u.cookie, u.hdfc), 48230);
  });

  test("simulate pending -> success (paisa hold, phir settle)", async () => {
    const u = await newUser();
    const r = await pay(u.cookie, { amount: 400, simulate: "pending" });
    assert.equal(r.data.transaction.status, "pending");
    assert.equal(await balanceOf(u.cookie, u.hdfc), 48230 - 400);
    const id = r.data.transaction.id;
    assert.equal((await call("txnId", "GET", `/api/transactions/${id}`, { cookie: u.cookie, ctx: idCtx(id) })).data.transaction.status, "pending");
    assert.equal((await call("txns", "GET", "/api/transactions?status=pending", { cookie: u.cookie })).data.transactions.length, 1);
    await sleep(450);
    const after = await call("txnId", "GET", `/api/transactions/${id}`, { cookie: u.cookie, ctx: idCtx(id) });
    assert.equal(after.data.transaction.status, "success");
    assert.equal(await balanceOf(u.cookie, u.hdfc), 48230 - 400);
  });

  test("simulate deferred_failed -> refund sirf ek baar", async () => {
    const u = await newUser();
    const r = await pay(u.cookie, { amount: 700, simulate: "deferred_failed" });
    assert.equal(await balanceOf(u.cookie, u.hdfc), 48230 - 700);
    await sleep(450);
    // parallel reads, settle race: refund ek hi baar
    await Promise.all([state(u.cookie), call("txns", "GET", "/api/transactions", { cookie: u.cookie }), state(u.cookie)]);
    assert.equal(await balanceOf(u.cookie, u.hdfc), 48230);
    const list = (await call("txns", "GET", "/api/transactions", { cookie: u.cookie })).data.transactions;
    assert.equal(list.find((t: any) => t.id === r.data.transaction.id).status, "failed");
    assert.equal(list.filter((t: any) => t.category === "Refund").length, 1);
  });

  test("simulate: invalid value, lite par, idempotency replay", async () => {
    const u = await newUser();
    assert.equal((await pay(u.cookie, { amount: 1, simulate: "hack" })).status, 400);
    assert.equal((await pay(u.cookie, { amount: 1, method: "lite", simulate: "pending" })).status, 400);
    const k = "sim-key-12345678";
    const a = await pay(u.cookie, { amount: 50, simulate: "pending", idempotencyKey: k });
    const b = await pay(u.cookie, { amount: 50, simulate: "pending", idempotencyKey: k });
    assert.equal(b.status, 200);
    assert.equal(b.data.transaction.id, a.data.transaction.id);
    assert.equal(await balanceOf(u.cookie, u.hdfc), 48230 - 50);
  });
});

describe("collect requests", () => {
  test("create -> payer approve (PIN) -> dono taraf paisa + history", async () => {
    const a = await newUser("Req Alice"), b = await newUser("Pay Bob");
    const aBal = await balanceOf(a.cookie, a.hdfc), bBal = await balanceOf(b.cookie, b.hdfc);
    const c = await call("collect", "POST", "/api/collect", { cookie: a.cookie, body: { payerVpa: b.upiId, amount: 300, note: "lunch" } });
    assert.equal(c.status, 201);
    const id = c.data.request.id;

    const inc = (await call("collect", "GET", "/api/collect", { cookie: b.cookie })).data.incoming;
    assert.equal(inc.length, 1); assert.equal(inc[0].requester.name, "Req Alice"); assert.equal(inc[0].status, "pending");
    assert.equal((await call("collect", "GET", "/api/collect", { cookie: a.cookie })).data.incoming.length, 0);

    // galat PIN: resolve nahi hoga
    assert.equal((await call("collectId", "POST", `/api/collect/${id}`, { cookie: b.cookie, ctx: idCtx(id), body: { action: "approve", pin: "9999" } })).status, 401);
    assert.equal((await call("collect", "GET", "/api/collect", { cookie: b.cookie })).data.incoming[0].status, "pending");
    // requester khud approve nahi kar sakta
    assert.equal((await call("collectId", "POST", `/api/collect/${id}`, { cookie: a.cookie, ctx: idCtx(id), body: { action: "approve", pin: "1234" } })).status, 404);

    const ok = await call("collectId", "POST", `/api/collect/${id}`, { cookie: b.cookie, ctx: idCtx(id), body: { action: "approve", pin: "1234" } });
    assert.equal(ok.status, 200); assert.equal(ok.data.request.status, "approved");
    assert.equal(await balanceOf(b.cookie, b.hdfc), bBal - 300);
    assert.equal(await balanceOf(a.cookie, a.hdfc), aBal + 300);
    assert.equal((await state(a.cookie)).recentTransactions[0].type, "credit");
    assert.equal((await state(b.cookie)).recentTransactions[0].type, "debit");

    // dobara approve: paisa dobara nahi katega
    assert.equal((await call("collectId", "POST", `/api/collect/${id}`, { cookie: b.cookie, ctx: idCtx(id), body: { action: "approve", pin: "1234" } })).status, 409);
    assert.equal(await balanceOf(b.cookie, b.hdfc), bBal - 300);
  });

  test("parallel double approve me sirf ek baar debit", async () => {
    const a = await newUser(), b = await newUser();
    const bBal = await balanceOf(b.cookie, b.hdfc);
    const id = (await call("collect", "POST", "/api/collect", { cookie: a.cookie, body: { payerVpa: b.upiId, amount: 100 } })).data.request.id;
    const rs = await Promise.all([1, 2, 3].map(() => call("collectId", "POST", `/api/collect/${id}`, { cookie: b.cookie, ctx: idCtx(id), body: { action: "approve", pin: "1234" } })));
    assert.equal(rs.filter((r) => r.status === 200).length, 1);
    assert.equal(await balanceOf(b.cookie, b.hdfc), bBal - 100);
  });

  test("decline, cancel, insufficient funds, validation", async () => {
    const a = await newUser(), b = await newUser();
    const mk = async (amount: number) => (await call("collect", "POST", "/api/collect", { cookie: a.cookie, body: { payerVpa: b.upiId, amount } })).data.request.id as number;
    const d = await mk(10);
    assert.equal((await call("collectId", "POST", `/api/collect/${d}`, { cookie: b.cookie, ctx: idCtx(d), body: { action: "decline" } })).data.request.status, "declined");
    const c = await mk(10);
    assert.equal((await call("collectId", "POST", `/api/collect/${c}`, { cookie: a.cookie, ctx: idCtx(c), body: { action: "cancel" } })).data.request.status, "cancelled");
    assert.equal((await call("collectId", "POST", `/api/collect/${c}`, { cookie: b.cookie, ctx: idCtx(c), body: { action: "decline" } })).status, 409);

    const big = await mk(90000);
    const bBal = await balanceOf(b.cookie, b.hdfc);
    const r = await call("collectId", "POST", `/api/collect/${big}`, { cookie: b.cookie, ctx: idCtx(big), body: { action: "approve", pin: "1234" } });
    assert.equal(r.status, 409); assert.equal(r.data.error.code, "INSUFFICIENT_FUNDS");
    assert.equal(await balanceOf(b.cookie, b.hdfc), bBal);
    assert.equal((await call("collect", "GET", "/api/collect", { cookie: b.cookie })).data.incoming.find((x: any) => x.id === big).status, "pending"); // rollback: pending hi raha

    const bad = (body: object) => call("collect", "POST", "/api/collect", { cookie: a.cookie, body });
    assert.equal((await bad({ payerVpa: a.upiId, amount: 5 })).status, 400);
    assert.equal((await bad({ payerVpa: "nobody@ekpay", amount: 5 })).status, 404);
    assert.equal((await bad({ payerVpa: b.upiId, amount: -5 })).status, 400);
    assert.equal((await bad({ payerVpa: "not a vpa", amount: 5 })).status, 400);
    assert.equal((await call("collect", "POST", "/api/collect", { body: { payerVpa: b.upiId, amount: 5 } })).status, 401);
    assert.equal((await call("collectId", "POST", `/api/collect/${d}`, { cookie: b.cookie, ctx: idCtx(d), body: { action: "steal" } })).status, 400);
  });

  test("expired request approve nahi hoti", async () => {
    const a = await newUser(), b = await newUser();
    const id = (await call("collect", "POST", "/api/collect", { cookie: a.cookie, body: { payerVpa: b.upiId, amount: 20 } })).data.request.id;
    const db = await import("../src/server/db");
    db.run("UPDATE collect_requests SET expires_at = 1 WHERE id = ?", id);
    const r = await call("collectId", "POST", `/api/collect/${id}`, { cookie: b.cookie, ctx: idCtx(id), body: { action: "approve", pin: "1234" } });
    assert.equal(r.status, 409);
    assert.equal((await call("collect", "GET", "/api/collect", { cookie: b.cookie })).data.incoming[0].status, "expired");
  });
});

describe("complaints", () => {
  test("raise, duplicate block, ownership, status tracking", async () => {
    const a = await newUser(), b = await newUser();
    const t = (await pay(a.cookie, { amount: 15, simulate: "failed" })).data.transaction;
    const body = { txnId: t.id, category: "failed_but_debited", description: "Paisa kata par payment fail dikha raha hai" };
    const c = await call("complaints", "POST", "/api/complaints", { cookie: a.cookie, body });
    assert.equal(c.status, 201);
    assert.match(c.data.complaint.ticket, /^CMP\d{8}$/);
    assert.equal(c.data.complaint.status, "open");

    assert.equal((await call("complaints", "POST", "/api/complaints", { cookie: a.cookie, body })).status, 409);
    assert.equal((await call("complaints", "POST", "/api/complaints", { cookie: b.cookie, body })).status, 404); // dusre ki txn
    assert.equal((await call("complaints", "POST", "/api/complaints", { cookie: a.cookie, body: { ...body, category: "x" } })).status, 400);
    assert.equal((await call("complaints", "POST", "/api/complaints", { cookie: a.cookie, body: { ...body, description: "short" } })).status, 400);
    assert.equal((await call("complaints", "GET", "/api/complaints", { cookie: b.cookie })).data.complaints.length, 0);

    await sleep(220);
    assert.equal((await call("complaints", "GET", "/api/complaints", { cookie: a.cookie })).data.complaints[0].status, "in_review");
    await sleep(300);
    const done = (await call("complaints", "GET", "/api/complaints", { cookie: a.cookie })).data.complaints[0];
    assert.equal(done.status, "resolved");
    // resolved ke baad nayi complaint dobara ho sakti hai
    assert.equal((await call("complaints", "POST", "/api/complaints", { cookie: a.cookie, body })).status, 201);
    const detail = await call("txnId", "GET", `/api/transactions/${t.id}`, { cookie: a.cookie, ctx: idCtx(t.id) });
    assert.ok(detail.data.complaint.ticket);
    assert.equal((await call("txnId", "GET", `/api/transactions/${t.id}`, { cookie: b.cookie, ctx: idCtx(t.id) })).status, 404);
  });
});

describe("security: external-API routes", () => {
  test("trains / stations / lookup-number ab login maangte hain", async () => {
    assert.equal((await call("trains", "GET", "/api/trains?from=BPL&to=NGP")).status, 401);
    assert.equal((await call("stations", "GET", "/api/stations?q=bho")).status, 401);
    assert.equal((await call("lookup", "GET", "/api/lookup-number?phone=9876543210")).status, 401);
  });

  test("bina key ke jhoothi 'valid' nahi, trains demo flagged, input validate", async () => {
    const saved = [process.env.RAPIDAPI_KEY, process.env.PHONE_LOOKUP_API_KEY];
    delete process.env.RAPIDAPI_KEY; delete process.env.PHONE_LOOKUP_API_KEY;
    try {
      const u = await newUser();
      const l = await call("lookup", "GET", "/api/lookup-number?phone=9876543210", { cookie: u.cookie });
      assert.equal(l.status, 503);
      const t = await call("trains", "GET", "/api/trains?from=BPL&to=NGP", { cookie: u.cookie });
      assert.equal(t.data.demo, true);
      assert.match(t.data.source, /demo/);
      assert.equal((await call("trains", "GET", "/api/trains?from=../../x&to=NGP", { cookie: u.cookie })).status, 400);
      const s = await call("stations", "GET", "/api/stations?q=bho", { cookie: u.cookie });
      assert.ok(s.data.stations.some((x: any) => x.code === "BPL"));
    } finally {
      if (saved[0]) process.env.RAPIDAPI_KEY = saved[0];
      if (saved[1]) process.env.PHONE_LOOKUP_API_KEY = saved[1];
    }
  });

  test("source me koi hardcoded API key nahi", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f.name)) {
          const s = fs.readFileSync(p, "utf8");
          if (/(?:API_KEY|apikey|KEY)\s*(?:=|:)\s*[^;\n]*\|\|\s*["'][A-Za-z0-9]{24,}["']/.test(s) || /["'][a-f0-9]{32}["']/.test(s) || /["'][0-9a-z]{20,}ms[0-9a-z]{20,}["']/.test(s)) hits.push(p);
        }
      }
    };
    walk(path.join(process.cwd(), "src"));
    assert.deepEqual(hits, []);
  });
});
EKPAY_EOF
mkdir -p "$(dirname '.env.example')"
cat > '.env.example' <<'EKPAY_EOF'
# Server-only secrets. Kabhi code me hardcode mat karo. Is file ko .env.local me copy karke real values bharo.
RAPIDAPI_KEY=
RAPIDAPI_IRCTC_HOST=irctc1.p.rapidapi.com
PHONE_LOOKUP_API_KEY=

# 'mock' = simulator. PSP bank + NPCI Common Library milne ke baad 'real' (src/server/upi/sdk.ts me RealUpiSdkService bharo).
EK_UPI_SDK=mock
# Optional: NPCI "UPI Live Members" se banayi JSON file (default: data/upi-banks.json)
EK_BANKS_FILE=
# Production me zaroor set karo
EK_PEPPER=
EK_DEMO_MODE=true
EKPAY_EOF

# .gitignore: .env.example commit hone do, backup folder ignore
grep -qxF '!.env.example' .gitignore || printf '\n# allow template, ignore upgrade backups\n!.env.example\n.ekpay-backup/\n' >> .gitignore

cat >> README.md <<'EKPAY_EOF'


## UPI Hub upgrade (simulator)

Naye features (sab `/upi` page par, backend `/api/*`):

| Feature | Endpoint |
|---|---|
| Bank list (searchable, popular upar) | `GET /api/banks?q=` |
| Bank me accounts dhundhna / link | `POST /api/banks/discover`, `POST /api/accounts/link` |
| Unlink / primary / balance (PIN ke saath) | `DELETE /api/accounts/:id`, `POST /api/accounts/primary`, `POST /api/accounts/balance` |
| Collect request (maango / approve / decline / cancel) | `GET,POST /api/collect`, `POST /api/collect/:id` |
| Transaction status (success / pending / failed) + detail | `GET /api/transactions?status=`, `GET /api/transactions/:id` |
| Complaints + status tracking | `GET,POST /api/complaints` |
| Forgot UPI PIN | `POST /api/auth/reset-pin` |

**NPCI Common Library abhi nahi hai**, isliye sab kuch `src/server/upi/sdk.ts` ke `UpiSdkService` interface ke peeche hai.
`MockUpiSdkService` chalta hai. PSP sandbox milne par `RealUpiSdkService` bharo aur `EK_UPI_SDK=real` karo.
Real UPI me PIN kabhi server/app tak nahi aata (sirf NPCI CL ka secure UI), mock me wo server par verify hota hai.

**Bank list:** `src/server/banks.ts` me ek seed list (~90 banks) hai, NPCI ki poori list nahi. Poori list ke liye NPCI ki
"UPI Live Members" list se `data/upi-banks.json` banao: `[{"id":"hdfc-bank","name":"HDFC Bank","category":"private","popular":true}]`.

**Simulate outcomes (sirf `EK_DEMO_MODE`):** `POST /api/payments` me `"simulate": "pending" | "deferred_failed" | "failed" | "bank_down"`.

**Secrets:** API keys sirf env se (`.env.example` dekho). Pehle teen routes me keys hardcoded thi: purani keys rotate karo.
EKPAY_EOF

if [ -z "${SKIP_NPM:-}" ]; then
  echo "==> Unused dependencies hata rahe hain (prisma, bcrypt: code me kahin use nahi hue)"
  npm uninstall prisma @prisma/client bcrypt @types/bcrypt
fi

echo
echo "Ho gaya. Ab:"
echo "  npm test          # 68 tests pass hone chahiye"
echo "  npm run dev       # phir browser me  /upi  kholo (pehle / par register/login)"
echo
echo "ZAROORI: RapidAPI + Numverify ki purani keys (code me hardcoded thi) abhi rotate karo."
