import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// DB path config import hone se PEHLE set hona chahiye
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ek-test-"));
process.env.EK_DB_PATH = path.join(tmp, "test.sqlite");

/* eslint-disable @typescript-eslint/no-explicit-any */
type Route = Record<string, (req: Request, ctx?: any) => Promise<Response>>;
const R: Record<string, Route> = {};
let dbRun: (sql: string, ...p: any[]) => any;
let dbOne: (sql: string, ...p: any[]) => any;

let ipCounter = 0;
async function call(route: string, method: string, url: string, o: { body?: unknown; raw?: string; cookie?: string; headers?: Record<string, string>; ctx?: any } = {}) {
  const headers: Record<string, string> = { "x-forwarded-for": `10.0.0.${++ipCounter}`, ...o.headers };
  const hasBody = o.body !== undefined || o.raw !== undefined;
  if (hasBody && !headers["content-type"]) headers["content-type"] = "application/json";
  if (o.cookie) headers.cookie = o.cookie;
  const req = new Request("http://localhost:3000" + url, {
    method, headers, body: hasBody ? (o.raw ?? JSON.stringify(o.body)) : undefined,
  });
  const res = await R[route][method](req, o.ctx);
  return { status: res.status, data: (await res.json()) as any, headers: res.headers };
}

let phoneSeq = 9000000000;
async function newUser(name = "Test User") {
  const phone = String(++phoneSeq);
  const r = await call("register", "POST", "/api/auth/register", { body: { phone, name, password: "StrongPass123", upiPin: "1234" } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  const st = await call("state", "GET", "/api/state", { cookie });
  const banks = st.data.banks as { id: number; balance: number; name: string }[];
  return { phone, cookie, banks, hdfc: banks[0].id, sbi: banks[1].id };
}
const pay = (cookie: string, body: Record<string, unknown>) =>
  call("payments", "POST", "/api/payments", { cookie, body: { receiver: "Ramesh Kirana", pin: "1234", ...body } });
const stateOf = async (cookie: string) => (await call("state", "GET", "/api/state", { cookie })).data;

before(async () => {
  const load = async (n: string, p: string) => (R[n] = (await import(p)) as Route);
  await load("register", "../src/app/api/auth/register/route");
  await load("login", "../src/app/api/auth/login/route");
  await load("logout", "../src/app/api/auth/logout/route");
  await load("me", "../src/app/api/auth/me/route");
  await load("changePin", "../src/app/api/auth/change-pin/route");
  await load("state", "../src/app/api/state/route");
  await load("payments", "../src/app/api/payments/route");
  await load("lite", "../src/app/api/upi-lite/topup/route");
  await load("txns", "../src/app/api/transactions/route");
  await load("trades", "../src/app/api/trades/route");
  await load("gold", "../src/app/api/gold/buy/route");
  await load("emi", "../src/app/api/loans/emi/route");
  await load("settings", "../src/app/api/settings/route");
  await load("sips", "../src/app/api/sips/route");
  await load("sipId", "../src/app/api/sips/[id]/route");
  await load("market", "../src/app/api/market/route");
  await load("deposit", "../src/app/api/accounts/deposit/route");
  await load("card", "../src/app/api/card/pay/route");
  await load("selfx", "../src/app/api/transfers/self/route");
  await load("offer", "../src/app/api/offerings/buy/route");
  const db = await import("../src/server/db");
  dbRun = (s, ...p) => db.run(s, ...p);
  dbOne = (s, ...p) => db.one(s, ...p);
});

describe("auth", () => {
  test("register validation", async () => {
    const bad = (b: object) => call("register", "POST", "/api/auth/register", { body: b });
    assert.equal((await bad({ phone: "12345", name: "Aa", password: "StrongPass123", upiPin: "1234" })).status, 400);
    assert.equal((await bad({ phone: "9111111111", name: "Aa", password: "short", upiPin: "1234" })).status, 400);
    assert.equal((await bad({ phone: "9111111111", name: "Aa", password: "StrongPass123", upiPin: "12" })).status, 400);
    assert.equal((await bad({ phone: "9111111111", name: "Aa", password: "StrongPass123", upiPin: "abcd" })).status, 400);
  });

  test("register -> cookie flags, hashed secrets, duplicate blocked, me works", async () => {
    const u = await newUser();
    const dup = await call("register", "POST", "/api/auth/register", { body: { phone: u.phone, name: "X Y", password: "StrongPass123", upiPin: "1234" } });
    assert.equal(dup.status, 409);
    const me = await call("me", "GET", "/api/auth/me", { cookie: u.cookie });
    assert.equal(me.data.user.phone, u.phone);
    const row = dbOne("SELECT password_hash, pin_hash FROM users WHERE phone = ?", u.phone);
    assert.match(row.password_hash, /^scrypt\$/);
    assert.match(row.pin_hash, /^scrypt\$/);
    assert.ok(!row.password_hash.includes("StrongPass123"));
    const reg = await call("register", "POST", "/api/auth/register", { body: { phone: String(++phoneSeq), name: "Cookie Check", password: "StrongPass123", upiPin: "1234" } });
    const sc = reg.headers.get("set-cookie")!;
    assert.match(sc, /HttpOnly/);
    assert.match(sc, /SameSite=Lax/);
  });

  test("unauthenticated requests are rejected", async () => {
    assert.equal((await call("me", "GET", "/api/auth/me")).status, 401);
    assert.equal((await call("state", "GET", "/api/state")).status, 401);
    assert.equal((await call("payments", "POST", "/api/payments", { body: { amount: 1, receiver: "x", pin: "1234" } })).status, 401);
    assert.equal((await call("trades", "POST", "/api/trades", { body: {} })).status, 401);
    assert.equal((await call("me", "GET", "/api/auth/me", { cookie: "ek_session=garbage" })).status, 401);
  });

  test("login: wrong password generic error, lockout after 5, logout kills session", async () => {
    const u = await newUser();
    const bad = () => call("login", "POST", "/api/auth/login", { body: { phone: u.phone, password: "WrongPassword1" } });
    const unknown = await call("login", "POST", "/api/auth/login", { body: { phone: "9999999999", password: "WrongPassword1" } });
    const first = await bad();
    assert.equal(first.status, 401);
    assert.equal(first.data.error.message, unknown.data.error.message); // user enumeration nahi
    for (let i = 0; i < 4; i++) assert.equal((await bad()).status, 401);
    const locked = await call("login", "POST", "/api/auth/login", { body: { phone: u.phone, password: "StrongPass123" } });
    assert.equal(locked.status, 423); // sahi password bhi ab nahi chalega
    assert.ok(locked.headers.get("retry-after"));

    const v = await newUser();
    const ok = await call("login", "POST", "/api/auth/login", { body: { phone: v.phone, password: "StrongPass123" } });
    assert.equal(ok.status, 200);
    const cookie = ok.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await call("me", "GET", "/api/auth/me", { cookie })).status, 200);
    const lo = await call("logout", "POST", "/api/auth/logout", { cookie });
    assert.match(lo.headers.get("set-cookie")!, /Max-Age=0/);
    assert.equal((await call("me", "GET", "/api/auth/me", { cookie })).status, 401);
  });

  test("change PIN: needs current PIN, old PIN stops working, new works", async () => {
    const u = await newUser();
    const change = (b: object) => call("changePin", "POST", "/api/auth/change-pin", { cookie: u.cookie, body: b });
    assert.equal((await change({ currentPin: "0000", newPin: "4321" })).status, 401);
    assert.equal((await change({ currentPin: "1234", newPin: "12" })).status, 400);
    assert.equal((await change({ currentPin: "1234", newPin: "4321" })).status, 200);
    assert.equal((await pay(u.cookie, { amount: 10, pin: "1234" })).status, 401);
    assert.equal((await pay(u.cookie, { amount: 10, pin: "4321" })).status, 201);
    assert.equal((await call("changePin", "POST", "/api/auth/change-pin", { body: { currentPin: "4321", newPin: "1111" } })).status, 401);
  });

  test("expired session rejected", async () => {
    const u = await newUser();
    dbRun("UPDATE sessions SET expires_at = ?", Date.now() - 1000);
    assert.equal((await call("me", "GET", "/api/auth/me", { cookie: u.cookie })).status, 401);
  });
});

describe("request hardening", () => {
  test("CSRF: cross-origin POST blocked, wrong content-type and bad JSON rejected", async () => {
    const u = await newUser();
    const evil = await call("payments", "POST", "/api/payments", {
      cookie: u.cookie, headers: { origin: "http://evil.com" }, body: { amount: 1, receiver: "x", pin: "1234" },
    });
    assert.equal(evil.status, 403);
    const sameOrigin = await call("payments", "POST", "/api/payments", {
      cookie: u.cookie, headers: { origin: "http://localhost:3000" }, body: { amount: 1, receiver: "Shop", pin: "1234" },
    });
    assert.equal(sameOrigin.status, 201);
    const sf = await call("payments", "POST", "/api/payments", {
      cookie: u.cookie, headers: { "sec-fetch-site": "cross-site" }, body: { amount: 1, receiver: "x", pin: "1234" },
    });
    assert.equal(sf.status, 403);
    assert.equal((await call("payments", "POST", "/api/payments", { cookie: u.cookie, headers: { "content-type": "text/plain" }, raw: "{}" })).status, 415);
    assert.equal((await call("payments", "POST", "/api/payments", { cookie: u.cookie, raw: "{not json" })).status, 400);
    assert.equal((await call("payments", "POST", "/api/payments", { cookie: u.cookie, raw: "[1,2]" })).status, 400);
  });
});

describe("state", () => {
  test("new user gets demo snapshot", async () => {
    const u = await newUser();
    const s = await stateOf(u.cookie);
    assert.equal(s.banks.length, 3);
    assert.equal(s.totalBalance, 69685);
    assert.equal(s.banks[0].label, "HDFC Bank ••4521");
    assert.equal(s.goldGrams, 4.5);
    assert.equal(s.holdings.length, 3);
    assert.equal(s.sips.length, 3);
    assert.equal(s.loans[0].paidEmis, 14);
    assert.equal(s.upiLiteBalance, 420);
    assert.equal((await call("market", "GET", "/api/market", { cookie: u.cookie })).data.quotes.length, 8);
  });
  test("old open-write endpoint is gone (no POST export)", () => {
    assert.equal(R.state.POST, undefined);
  });
});

describe("payments", () => {
  test("correct PIN debits exactly once; ref is 12 digits", async () => {
    const u = await newUser();
    const r = await pay(u.cookie, { amount: 500, category: "Bills", note: "milk" });
    assert.equal(r.status, 201);
    assert.equal(r.data.balance, 47730);
    assert.match(r.data.transaction.ref, /^\d{12}$/);
    assert.equal(r.data.transaction.type, "debit");
    assert.equal((await stateOf(u.cookie)).banks[0].balance, 47730);
  });

  test("wrong PIN: no debit, remaining attempts shown", async () => {
    const u = await newUser();
    const r = await pay(u.cookie, { amount: 500, pin: "9999" });
    assert.equal(r.status, 401);
    assert.equal(r.data.error.code, "INVALID_PIN");
    assert.equal(r.data.error.remainingAttempts, 4);
    assert.equal((await stateOf(u.cookie)).banks[0].balance, 48230);
    assert.equal((await pay(u.cookie, { amount: 1, pin: "12" })).status, 400); // format galat: attempt count nahi hota
    assert.equal((await pay(u.cookie, { amount: 1, pin: undefined })).status, 400);
  });

  test("PIN lockout after 5 wrong; correct PIN also blocked while locked", async () => {
    const u = await newUser();
    for (let i = 0; i < 5; i++) assert.equal((await pay(u.cookie, { amount: 10, pin: "0000" })).status, 401);
    const r = await pay(u.cookie, { amount: 10, pin: "1234" });
    assert.equal(r.status, 423);
    assert.equal((await stateOf(u.cookie)).banks[0].balance, 48230);
  });

  test("20 PARALLEL wrong-PIN guesses: sirf 5 verify hote hain, baaki locked", async () => {
    const u = await newUser();
    const results = await Promise.all(Array.from({ length: 20 }, () => pay(u.cookie, { amount: 10, pin: "0000" })));
    assert.equal(results.filter((r) => r.status === 401).length, 5);
    assert.equal(results.filter((r) => r.status === 423).length, 15);
  });

  test("idempotency: same key twice = one debit, same transaction", async () => {
    const u = await newUser();
    const key = "idem-key-0001";
    const a = await pay(u.cookie, { amount: 700, idempotencyKey: key });
    const b = await pay(u.cookie, { amount: 700, idempotencyKey: key, pin: "0000" }); // replay me PIN dobara nahi poochta
    assert.equal(a.status, 201);
    assert.equal(b.status, 200);
    assert.equal(b.data.replayed, true);
    assert.equal(a.data.transaction.id, b.data.transaction.id);
    assert.equal((await stateOf(u.cookie)).banks[0].balance, 47530);
  });

  test("amount validation", async () => {
    const u = await newUser();
    for (const amount of [0, -5, "abc", 10.555, 100000.01, null, Infinity, "1e3"]) {
      const r = await pay(u.cookie, { amount });
      assert.equal(r.status, 400, `amount=${String(amount)} -> ${r.status}`);
    }
    assert.equal((await pay(u.cookie, { amount: "250.50" })).status, 201);
    assert.equal((await stateOf(u.cookie)).banks[0].balance, 47979.5);
    assert.equal((await pay(u.cookie, { amount: 10, vpa: "bad vpa" })).status, 400);
    assert.equal((await pay(u.cookie, { amount: 10, vpa: "shop@okbank" })).status, 201);
  });

  test("insufficient funds -> 409, balance unchanged, never negative", async () => {
    const u = await newUser();
    const r = await pay(u.cookie, { amount: 20000, bankAccountId: u.sbi }); // SBI me 12,540
    assert.equal(r.status, 409);
    assert.equal(r.data.error.code, "INSUFFICIENT_FUNDS");
    assert.equal((await stateOf(u.cookie)).banks[1].balance, 12540);
  });

  test("cannot spend from another user's account (IDOR)", async () => {
    const a = await newUser();
    const b = await newUser();
    const r = await pay(b.cookie, { amount: 100, bankAccountId: a.hdfc });
    assert.equal(r.status, 404);
    assert.equal((await stateOf(a.cookie)).banks[0].balance, 48230);
  });

  test("CONCURRENCY: 20 parallel ₹5000 payments from ₹48,230 -> exactly 9 succeed", async () => {
    const u = await newUser();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => pay(u.cookie, { amount: 5000, idempotencyKey: `parallel-key-${i}-xxxx` }))
    );
    assert.equal(results.filter((r) => r.status === 201).length, 9);
    assert.equal(results.filter((r) => r.status === 409).length, 11);
    const s = await stateOf(u.cookie);
    assert.equal(s.banks[0].balance, 3230);
    const sum = dbOne("SELECT COALESCE(SUM(amount_paise),0) AS s FROM transactions WHERE user_id = (SELECT id FROM users WHERE phone = ?)", u.phone);
    assert.equal(sum.s, 45000_00); // ledger = balance change
  });
});

describe("UPI Lite", () => {
  test("topup, pin-less pay, limits (₹500 per payment, ₹2,000 wallet)", async () => {
    const u = await newUser();
    const lite = (b: object) => call("lite", "POST", "/api/upi-lite/topup", { cookie: u.cookie, body: { pin: "1234", ...b } });
    const t = await lite({ amount: 1000 });
    assert.equal(t.status, 201);
    assert.equal(t.data.liteBalance, 1420);
    assert.equal((await lite({ amount: 1000 })).status, 400); // 2420 > ₹2,000 cap
    assert.equal((await lite({ amount: 5000 })).status, 400);
    assert.equal((await lite({ amount: 100, pin: "0000" })).status, 401);

    const p = await pay(u.cookie, { amount: 500, method: "lite", pin: undefined });
    assert.equal(p.status, 201);
    assert.equal(p.data.balance, 920);
    assert.equal((await pay(u.cookie, { amount: 501, method: "lite", pin: undefined })).data.error.code, "LITE_LIMIT");
    assert.equal((await pay(u.cookie, { amount: 500, method: "lite", pin: undefined })).status, 201); // 420 bache
    assert.equal((await pay(u.cookie, { amount: 500, method: "lite", pin: undefined })).status, 409); // balance kam
    const s = await stateOf(u.cookie);
    assert.equal(s.upiLiteBalance, 420);
    assert.equal(s.banks[0].balance, 47230);
  });
});

describe("trading, gold, EMI", () => {
  const trade = (cookie: string, body: Record<string, unknown>) => call("trades", "POST", "/api/trades", { cookie, body });

  test("buy uses SERVER price (client price ignored) + weighted average", async () => {
    const u = await newUser();
    const r = await trade(u.cookie, { symbol: "reliance", side: "buy", qty: 3, price: 1 });
    assert.equal(r.status, 201);
    assert.equal(r.data.order.price, 2945.3);
    assert.equal(r.data.order.total, 8835.9);
    const s = await stateOf(u.cookie);
    const h = s.holdings.find((x: any) => x.symbol === "RELIANCE");
    assert.equal(h.qty, 15);
    assert.equal(h.avgPrice, 2813.06); // (12*2780 + 3*2945.30)/15
    assert.equal(s.banks[0].balance, 48230 - 8835.9);
  });

  test("sell: credits account, removes holding at 0, blocks overselling", async () => {
    const u = await newUser();
    assert.equal((await trade(u.cookie, { symbol: "RELIANCE", side: "sell", qty: 100 })).status, 409);
    const r = await trade(u.cookie, { symbol: "ZOMATO", side: "sell", qty: 60 });
    assert.equal(r.status, 201);
    const s = await stateOf(u.cookie);
    assert.ok(!s.holdings.find((x: any) => x.symbol === "ZOMATO"));
    assert.equal(s.banks[0].balance, 48230 + 60 * 265.3);
  });

  test("trade validation", async () => {
    const u = await newUser();
    assert.equal((await trade(u.cookie, { symbol: "NOPE", side: "buy", qty: 1 })).status, 404);
    assert.equal((await trade(u.cookie, { symbol: "TCS", side: "hold", qty: 1 })).status, 400);
    for (const qty of [0, -1, 1.5, "2", 10001]) assert.equal((await trade(u.cookie, { symbol: "TCS", side: "buy", qty })).status, 400);
    assert.equal((await trade(u.cookie, { symbol: "TCS", side: "buy", qty: 5000 })).status, 409); // paisa kam
  });

  test("gold: user ko exactly wahi amount katta hai, gram microgram precision me", async () => {
    const u = await newUser();
    const r = await call("gold", "POST", "/api/gold/buy", { cookie: u.cookie, body: { amount: 1000 } });
    assert.equal(r.status, 201);
    assert.equal(r.data.transaction.amount, 1000); // pehle ₹993.14 katta tha
    assert.equal(r.data.boughtGrams, 0.127877); // 1000 / 7820
    assert.equal(r.data.totalGrams, 4.627877);
    assert.equal((await stateOf(u.cookie)).banks[0].balance, 47230);
    assert.equal((await call("gold", "POST", "/api/gold/buy", { cookie: u.cookie, body: { amount: 5 } })).status, 400);
  });

  test("EMI: server decides amount; closed loan blocked; other user's loan hidden", async () => {
    const a = await newUser();
    const b = await newUser();
    const loanA = (await stateOf(a.cookie)).loans[0].id;
    const r = await call("emi", "POST", "/api/loans/emi", { cookie: a.cookie, body: { loanId: loanA, amount: 1 } });
    assert.equal(r.status, 201);
    assert.equal(r.data.paidEmis, 15);
    assert.equal(r.data.transaction.amount, 3240);
    assert.equal((await call("emi", "POST", "/api/loans/emi", { cookie: b.cookie, body: { loanId: loanA } })).status, 404);
    dbRun("UPDATE loans SET paid_emis = total_emis WHERE id = ?", loanA);
    assert.equal((await call("emi", "POST", "/api/loans/emi", { cookie: a.cookie, body: { loanId: loanA } })).data.error.code, "LOAN_CLOSED");
  });
});

describe("transactions, SIPs, settings", () => {
  test("pagination, filter, search (LIKE wildcards escaped)", async () => {
    const u = await newUser();
    await pay(u.cookie, { amount: 10, receiver: "Alpha Store", category: "Bills" });
    await pay(u.cookie, { amount: 20, receiver: "Beta Cafe", category: "Food" });
    await pay(u.cookie, { amount: 30, receiver: "100% Gold", category: "Food" });
    const get = (qs: string) => call("txns", "GET", "/api/transactions" + qs, { cookie: u.cookie });
    const p1 = await get("?limit=2");
    assert.equal(p1.data.transactions.length, 2);
    assert.equal(p1.data.transactions[0].counterparty, "100% Gold"); // latest first
    assert.ok(p1.data.nextCursor);
    const p2 = await get(`?limit=2&before=${p1.data.nextCursor}`);
    assert.equal(p2.data.transactions.length, 1);
    assert.equal(p2.data.nextCursor, null);
    assert.equal((await get("?category=Food")).data.transactions.length, 2);
    assert.equal((await get("?q=beta")).data.transactions.length, 1);
    assert.equal((await get("?q=%25")).data.transactions.length, 1); // '%' literal match, wildcard nahi
    assert.equal((await get("?limit=100")).status, 400);
    assert.equal((await get("?before=abc")).status, 400);
  });

  test("transaction history is private per user", async () => {
    const a = await newUser();
    const b = await newUser();
    await pay(a.cookie, { amount: 11, receiver: "SecretShop" });
    const r = await call("txns", "GET", "/api/transactions?q=SecretShop", { cookie: b.cookie });
    assert.equal(r.data.transactions.length, 0);
  });

  test("SIP create/delete, validation, ownership", async () => {
    const a = await newUser();
    const b = await newUser();
    const c = await call("sips", "POST", "/api/sips", { cookie: a.cookie, body: { name: "Axis Bluechip", amount: 1500, dayOfMonth: 7 } });
    assert.equal(c.status, 201);
    assert.equal((await call("sips", "POST", "/api/sips", { cookie: a.cookie, body: { name: "Bad", amount: 1500, dayOfMonth: 31 } })).status, 400);
    assert.equal((await call("sips", "POST", "/api/sips", { cookie: a.cookie, body: { name: "Bad", amount: 5, dayOfMonth: 5 } })).status, 400);
    const id = c.data.sip.id;
    const del = (cookie: string, rid: string) => call("sipId", "DELETE", `/api/sips/${rid}`, { cookie, ctx: { params: Promise.resolve({ id: rid }) } });
    assert.equal((await del(b.cookie, String(id))).status, 404);
    assert.equal((await del(a.cookie, "abc")).status, 400);
    assert.equal((await del(a.cookie, String(id))).status, 200);
    assert.equal((await stateOf(a.cookie)).sips.length, 3);
  });

  test("SIP with first installment: debits primary account atomically", async () => {
    const u = await newUser();
    const sip = (b: object) => call("sips", "POST", "/api/sips", { cookie: u.cookie, body: { name: "HDFC Mid-Cap Opportunities", amount: 500, dayOfMonth: 5, ...b } });
    const a = await sip({ payFirstInstallment: true, idempotencyKey: "sip-key-000001" });
    assert.equal(a.status, 201);
    assert.equal(a.data.transaction.amount, 500);
    assert.equal(a.data.transaction.counterparty, "SIP: HDFC Mid-Cap Opportunities");
    const s1 = await stateOf(u.cookie);
    assert.equal(s1.banks[0].balance, 47730);
    assert.equal(s1.sips.length, 4);
    const again = await sip({ payFirstInstallment: true, idempotencyKey: "sip-key-000001" });
    assert.equal(again.data.replayed, true);
    const s2 = await stateOf(u.cookie);
    assert.equal(s2.banks[0].balance, 47730); // double charge nahi
    assert.equal(s2.sips.length, 4); // double SIP nahi
    const poor = await sip({ amount: 60000, payFirstInstallment: true });
    assert.equal(poor.status, 409);
    assert.equal((await stateOf(u.cookie)).sips.length, 4); // fail hua to SIP bhi nahi bana
  });

  test("budget update + validation", async () => {
    const u = await newUser();
    const set = (budget: unknown) => call("settings", "PATCH", "/api/settings", { cookie: u.cookie, body: { budget } });
    assert.equal((await set(30000)).status, 200);
    assert.equal((await stateOf(u.cookie)).budget, 30000);
    assert.equal((await set(-1)).status, 400);
    assert.equal((await set("lots")).status, 400);
  });
});

describe("deposit, card bill, self transfer, offerings", () => {
  test("demo deposit credits account; capped; rate limited", async () => {
    const u = await newUser();
    const dep = (b: object) => call("deposit", "POST", "/api/accounts/deposit", { cookie: u.cookie, body: b });
    const r = await dep({ amount: 10000, bankAccountId: u.sbi });
    assert.equal(r.status, 201);
    assert.equal(r.data.transaction.type, "credit");
    assert.equal((await stateOf(u.cookie)).banks[1].balance, 22540);
    assert.equal((await dep({ amount: 50001 })).status, 400);
    assert.equal((await dep({ amount: -5 })).status, 400);
    const k = await dep({ amount: 100, idempotencyKey: "dep-key-0000001" });
    const k2 = await dep({ amount: 100, idempotencyKey: "dep-key-0000001" });
    assert.equal(k2.data.replayed, true);
    assert.equal((await stateOf(u.cookie)).banks[0].balance, 48330); // sirf ek baar +100
    assert.equal(k.status, 201);
    for (let i = 0; i < 20; i++) await dep({ amount: 1 });
    assert.equal((await dep({ amount: 1 })).status, 429);
  });

  test("card bill: full due, partial, no-due, insufficient funds", async () => {
    const u = await newUser();
    const payBill = (b: object = {}) => call("card", "POST", "/api/card/pay", { cookie: u.cookie, body: b });
    const part = await payBill({ amount: 400 });
    assert.equal(part.status, 201);
    assert.equal(part.data.remainingDue, 18020);
    assert.equal((await payBill({ amount: 99999 })).status, 400); // due se zyada
    const full = await payBill();
    assert.equal(full.status, 201);
    assert.equal(full.data.transaction.amount, 18020);
    const s = await stateOf(u.cookie);
    assert.equal(s.cardDue, 0);
    assert.equal(s.banks[0].balance, 48230 - 18420);
    assert.equal((await payBill()).data.error.code, "NO_DUE");

    const v = await newUser();
    dbRun("UPDATE bank_accounts SET balance_paise = 100 WHERE user_id = (SELECT id FROM users WHERE phone = ?) AND is_primary = 1", v.phone);
    const poor = await call("card", "POST", "/api/card/pay", { cookie: v.cookie, body: {} });
    assert.equal(poor.status, 409);
    assert.equal((await stateOf(v.cookie)).cardDue, 18420); // fail pe due nahi ghata
  });

  test("self transfer: moves money, two ledger legs, no cross-user, no same account", async () => {
    const a = await newUser();
    const b = await newUser();
    const xfer = (cookie: string, body: object) => call("selfx", "POST", "/api/transfers/self", { cookie, body });
    const r = await xfer(a.cookie, { fromAccountId: a.hdfc, toAccountId: a.sbi, amount: 2000 });
    assert.equal(r.status, 201);
    const s = await stateOf(a.cookie);
    assert.equal(s.banks[0].balance, 46230);
    assert.equal(s.banks[1].balance, 14540);
    assert.equal(s.totalBalance, 69685); // total same rehta hai
    const legs = (await call("txns", "GET", "/api/transactions?category=Self%20Transfer", { cookie: a.cookie })).data.transactions;
    assert.deepEqual(legs.map((t: any) => t.type).sort(), ["credit", "debit"]);
    assert.equal((await xfer(a.cookie, { fromAccountId: a.hdfc, toAccountId: a.hdfc, amount: 10 })).status, 400);
    assert.equal((await xfer(a.cookie, { fromAccountId: a.hdfc, toAccountId: b.hdfc, amount: 10 })).status, 404); // dusre ka account
    assert.equal((await xfer(a.cookie, { fromAccountId: b.hdfc, toAccountId: a.hdfc, amount: 10 })).status, 404);
    assert.equal((await xfer(a.cookie, { fromAccountId: a.sbi, toAccountId: a.hdfc, amount: 999999 })).status, 400);
    assert.equal((await xfer(a.cookie, { fromAccountId: a.sbi, toAccountId: a.hdfc, amount: 90000 })).status, 409);
    const k = { fromAccountId: a.hdfc, toAccountId: a.sbi, amount: 100, idempotencyKey: "self-key-000001" };
    await xfer(a.cookie, k);
    assert.equal((await xfer(a.cookie, k)).data.replayed, true);
    assert.equal((await stateOf(a.cookie)).banks[0].balance, 46130); // sirf ek baar
  });

  test("offerings: server price, unknown plan rejected", async () => {
    const u = await newUser();
    const buy = (b: object) => call("offer", "POST", "/api/offerings/buy", { cookie: u.cookie, body: b });
    const r = await buy({ category: "insurance", title: "Term Life Shield", amount: 1 }); // client amount ignore
    assert.equal(r.status, 201);
    assert.equal(r.data.transaction.amount, 749);
    assert.equal((await stateOf(u.cookie)).banks[0].balance, 48230 - 749);
    assert.equal((await buy({ category: "insurance", title: "Fake Plan" })).status, 404);
    assert.equal((await buy({ category: "constructor", title: "Term Life Shield" })).status, 404);
    assert.equal((await buy({ category: "__proto__", title: "x1" })).status, 404);
    const big = await buy({ category: "ipo", title: "FinEdge Tech IPO" });
    assert.equal(big.data.transaction.amount, 14874);
  });
});

describe("server data matches page.tsx (drift check)", () => {
  const page = fs.readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");

  test("offerings catalog: titles and prices", async () => {
    const { CATALOG } = await import("../src/server/catalog");
    const block = page.slice(page.indexOf("const CATALOG:"), page.indexOf("const SCREEN_TITLES"));
    const found = [...block.matchAll(/\["([^"]+)", "[^"]*", "[^"]*", (\d+)\]/g)].map((m) => [m[1], Number(m[2])] as const);
    const server = Object.values(CATALOG).flat().map((o) => [o.title, o.pricePaise / 100] as const);
    assert.ok(found.length >= 14);
    assert.deepEqual(found, server);
  });

  test("stock prices", async () => {
    const { listQuotes } = await import("../src/server/market");
    const block = page.slice(page.indexOf("const ST = ["), page.indexOf("const MF = ["));
    const found = [...block.matchAll(/\["([A-Z]+)", "[^"]+", ([\d.]+), /g)].map((m) => [m[1], Number(m[2])] as const);
    const server = listQuotes().map((q) => [q.symbol, q.price] as const);
    assert.equal(found.length, 8);
    assert.deepEqual(found, server);
  });

  test("gold price and EMI amount used in UI text", () => {
    assert.ok(page.includes("7820"));
    assert.ok(page.includes("3240"));
  });
});

describe("hardening round 2", () => {
  test("oversized request body is rejected (413)", async () => {
    const u = await newUser();
    const big = await call("payments", "POST", "/api/payments", { cookie: u.cookie, body: { amount: 1, receiver: "x".repeat(20_000), pin: "1234" } });
    assert.equal(big.status, 413);
    assert.equal(big.data.error.code, "PAYLOAD_TOO_LARGE");
  });

  test("idempotency key reused with a DIFFERENT amount is rejected, same amount replays", async () => {
    const u = await newUser();
    const key = "reuse-key-00001";
    assert.equal((await pay(u.cookie, { amount: 100, idempotencyKey: key })).status, 201);
    const bad = await pay(u.cookie, { amount: 9000, idempotencyKey: key });
    assert.equal(bad.status, 409);
    assert.equal(bad.data.error.code, "IDEMPOTENCY_KEY_REUSED");
    assert.equal((await pay(u.cookie, { amount: 100, idempotencyKey: key })).data.replayed, true);
    assert.equal((await stateOf(u.cookie)).banks[0].balance, 48130); // sirf ek baar ₹100 kata
    const gk = "reuse-gold-0001";
    await call("gold", "POST", "/api/gold/buy", { cookie: u.cookie, body: { amount: 500, idempotencyKey: gk } });
    const g2 = await call("gold", "POST", "/api/gold/buy", { cookie: u.cookie, body: { amount: 700, idempotencyKey: gk } });
    assert.equal(g2.data.error.code, "IDEMPOTENCY_KEY_REUSED");
  });

  test("EK_DEMO_MODE=false turns the free deposit endpoint off", async () => {
    const u = await newUser();
    process.env.EK_DEMO_MODE = "false";
    try {
      const r = await call("deposit", "POST", "/api/accounts/deposit", { cookie: u.cookie, body: { amount: 100 } });
      assert.equal(r.status, 404);
    } finally {
      delete process.env.EK_DEMO_MODE;
    }
    assert.equal((await call("deposit", "POST", "/api/accounts/deposit", { cookie: u.cookie, body: { amount: 100 } })).status, 201);
  });
});
