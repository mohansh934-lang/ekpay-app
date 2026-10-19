import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

export type SqlValue = string | number | bigint | null;
export type Row = Record<string, unknown>;

interface Statement {
  run(...params: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: SqlValue[]): Row | undefined;
  all(...params: SqlValue[]): Row[];
}
export interface DB {
  exec(sql: string): void;
  prepare(sql: string): Statement;
}

const SCHEMA_V1 = `
CREATE TABLE users (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  phone              TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  upi_id             TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  pin_hash           TEXT NOT NULL,
  login_failures     INTEGER NOT NULL DEFAULT 0,
  login_locked_until INTEGER NOT NULL DEFAULT 0,
  pin_failures       INTEGER NOT NULL DEFAULT 0,
  pin_locked_until   INTEGER NOT NULL DEFAULT 0,
  created_at         INTEGER NOT NULL
);

CREATE TABLE sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  user_agent TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE bank_accounts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_name     TEXT NOT NULL,
  last4         TEXT NOT NULL,
  balance_paise INTEGER NOT NULL CHECK (balance_paise >= 0),
  is_primary    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_accounts_user ON bank_accounts(user_id);

CREATE TABLE wallets (
  user_id            INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lite_balance_paise INTEGER NOT NULL DEFAULT 0 CHECK (lite_balance_paise >= 0),
  gold_mg            INTEGER NOT NULL DEFAULT 0 CHECK (gold_mg >= 0),
  card_due_paise     INTEGER NOT NULL DEFAULT 0 CHECK (card_due_paise >= 0),
  budget_paise       INTEGER NOT NULL DEFAULT 0 CHECK (budget_paise >= 0)
);

CREATE TABLE loans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  emi_paise   INTEGER NOT NULL CHECK (emi_paise > 0),
  total_emis  INTEGER NOT NULL CHECK (total_emis > 0),
  paid_emis   INTEGER NOT NULL DEFAULT 0,
  CHECK (paid_emis >= 0 AND paid_emis <= total_emis)
);

CREATE TABLE transactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('debit','credit')),
  category        TEXT NOT NULL,
  counterparty    TEXT NOT NULL,
  amount_paise    INTEGER NOT NULL CHECK (amount_paise > 0),
  source          TEXT NOT NULL,
  bank_account_id INTEGER REFERENCES bank_accounts(id),
  bank_label      TEXT NOT NULL,
  ref             TEXT NOT NULL UNIQUE,
  note            TEXT,
  idempotency_key TEXT,
  created_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX uq_txn_idem ON transactions(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_txn_user ON transactions(user_id, id DESC);

CREATE TABLE holdings (
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol          TEXT NOT NULL,
  qty             INTEGER NOT NULL CHECK (qty > 0),
  avg_price_paise INTEGER NOT NULL CHECK (avg_price_paise > 0),
  PRIMARY KEY (user_id, symbol)
);

CREATE TABLE orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  side        TEXT NOT NULL CHECK (side IN ('buy','sell')),
  qty         INTEGER NOT NULL CHECK (qty > 0),
  price_paise INTEGER NOT NULL,
  total_paise INTEGER NOT NULL,
  txn_id      INTEGER REFERENCES transactions(id),
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_orders_user ON orders(user_id, id DESC);

CREATE TABLE sips (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 28),
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_sips_user ON sips(user_id);
`;

/** Naya change = naya migration push karo. Purane ko kabhi edit mat karo. */
const SCHEMA_V2 = `
-- Gold ab microgram me (1 g = 1,000,000 ug). Milligram me rounding se ₹1,000 ke gold par ~₹7 ka farq aata tha.
ALTER TABLE wallets RENAME COLUMN gold_mg TO gold_ug;
UPDATE wallets SET gold_ug = gold_ug * 1000;
`;

/**
 * App settings (theme, sound, privacy...) server pe, taaki har device pe same rahein.
 * NOTE: default_account_id column ab use nahi hoti ("default bank" feature hata diya gaya). Migration immutable hai
 * aur SQLite foreign-key wali column drop nahi karne deta, isliye column bas pada rehta hai.
 */
const SCHEMA_V3 = `
CREATE TABLE user_settings (
  user_id            INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme              TEXT    NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark','system')),
  sound_on           INTEGER NOT NULL DEFAULT 1 CHECK (sound_on IN (0,1)),
  hide_balance       INTEGER NOT NULL DEFAULT 0 CHECK (hide_balance IN (0,1)),
  intl_upi           INTEGER NOT NULL DEFAULT 0 CHECK (intl_upi IN (0,1)),
  pay_alerts         INTEGER NOT NULL DEFAULT 1 CHECK (pay_alerts IN (0,1)),
  default_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL,
  updated_at         INTEGER NOT NULL
);
`;

/**
 * V4: UPI simulator upgrade.
 *  - transactions.status (success / pending / failed) + pending settle fields
 *  - bank_accounts.active (unlink = soft delete, kyunki purani transactions us account ko reference karti hain)
 *  - collect_requests (request money) aur complaints (dispute tracking)
 */
const SCHEMA_V4 = `
ALTER TABLE transactions ADD COLUMN status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','pending','failed'));
ALTER TABLE transactions ADD COLUMN settles_at INTEGER;
ALTER TABLE transactions ADD COLUMN final_status TEXT CHECK (final_status IN ('success','failed'));
ALTER TABLE transactions ADD COLUMN failure_reason TEXT;
CREATE INDEX idx_txn_pending ON transactions(user_id, status) WHERE status = 'pending';

ALTER TABLE bank_accounts ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1));
ALTER TABLE bank_accounts ADD COLUMN ifsc TEXT;

CREATE TABLE collect_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payer_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled','expired')),
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  resolved_at  INTEGER,
  txn_id       INTEGER REFERENCES transactions(id)
);
CREATE INDEX idx_collect_payer ON collect_requests(payer_id, status);
CREATE INDEX idx_collect_requester ON collect_requests(requester_id, id DESC);

CREATE TABLE complaints (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  txn_id      INTEGER NOT NULL REFERENCES transactions(id),
  ticket      TEXT NOT NULL UNIQUE,
  category    TEXT NOT NULL CHECK (category IN ('debited_not_received','failed_but_debited','wrong_payee','duplicate_charge','pending_too_long','other')),
  description TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','rejected')),
  resolution  TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX uq_complaint_active ON complaints(txn_id) WHERE status IN ('open','in_review');
CREATE INDEX idx_complaints_user ON complaints(user_id, id DESC);
`;

export const MIGRATIONS: string[] = [SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4];

function open(): DB {
  const proc = process as unknown as { getBuiltinModule?: (id: string) => unknown };
  // getBuiltinModule use kiya taaki bundler 'node:sqlite' resolve karne ki koshish na kare.
  const mod = proc.getBuiltinModule?.("node:sqlite") as
    | { DatabaseSync: new (file: string) => DB }
    | undefined;
  if (!mod) throw new Error("node:sqlite available nahi hai. Node.js 22.13+ chahiye.");

  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = new mod.DatabaseSync(config.dbPath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;");
  migrate(db);
  return db;
}

/** Jo migrations abhi tak nahi chali (PRAGMA user_version se pata chalta hai) wahi chalti hain. Dobara chalane pe safe. */
function migrate(db: DB) {
  const current = Number((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version);
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

const g = globalThis as unknown as { __ekDb?: DB; __ekDbSchema?: number };
/**
 * Lazy singleton (dev hot-reload me bhi ek hi connection).
 * Dev me code reload hone par connection purana rehta hai: agar tab tak naya migration add ho gaya ho
 * to use isi connection par chala do (warna "no such table" jaise errors aate hain jab tak server restart na ho).
 */
export const getDb = (): DB => {
  if (!g.__ekDb) {
    g.__ekDb = open();
  } else if (g.__ekDbSchema !== MIGRATIONS.length) {
    migrate(g.__ekDb);
  }
  g.__ekDbSchema = MIGRATIONS.length;
  return g.__ekDb;
};

/**
 * Atomic transaction. fn SYNC honi chahiye (await mat karna andar), tabhi BEGIN IMMEDIATE
 * ke beech koi dusri request beech me nahi ghus sakti. Error aaya to sab ROLLBACK.
 */
export function transaction<T>(fn: (db: DB) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch { /* already rolled back */ }
    throw e;
  }
}

export const one = <T = Row>(sql: string, ...p: SqlValue[]) => getDb().prepare(sql).get(...p) as T | undefined;
export const many = <T = Row>(sql: string, ...p: SqlValue[]) => getDb().prepare(sql).all(...p) as T[];
export const run = (sql: string, ...p: SqlValue[]) => getDb().prepare(sql).run(...p);
