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
