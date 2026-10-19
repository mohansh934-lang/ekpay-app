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
