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
