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

export const MIGRATIONS: string[] = [SCHEMA_V1, SCHEMA_V2];

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
  return db;
}

const g = globalThis as unknown as { __ekDb?: DB };
/** Lazy singleton (dev hot-reload me bhi ek hi connection). */
export const getDb = (): DB => (g.__ekDb ??= open());

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
