"use client";

import { useEffect, useRef } from "react";
import { inr } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { useEk } from "@/context/EkContext";

/** Mobile / UPI ID chat-style pay screen (EK-CHAT-SCREEN) */
export function ChatScreen() {
  const {
    contacts, payToIdx, payAmt, setPayAmt, banks, payBankIdx, txns,
    back, go, showToast, setPin, setPinErr, payKey, setPinSheet, loadCollectAndComplaints,
  } = useEk();
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const c = contacts[payToIdx];
  const name = c ? c[0] : "";
  const past = c ? txns.filter((t: any) => t.n === name).slice(0, 20).reverse() : [];

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [past.length]);

  if (!c) return null;

  const digits = c[1].replace(/\D/g, "");
  const sub = c[0] === c[2] ? "UPI ID" : digits.length >= 10 ? c[1] : c[2];
  const words = name.replace(/[^A-Za-z ]/g, " ").trim().split(/\s+/).filter(Boolean);
  const initials = words.length ? words.slice(0, 2).map((w: string) => w[0]).join("").toUpperCase() : "#";
  const short = name.length > 18 ? name.slice(0, 15) + "..." : name;

  const startPay = (a: number) => {
    if (!a || a <= 0) return showToast("Amount daalo");
    if (a > 100000) return showToast("Ek payment me max ₹1,00,000");
    if (banks[payBankIdx] && a > banks[payBankIdx][1]) return showToast("Account me balance kam hai");
    (document.activeElement as HTMLElement | null)?.blur();
    setPayAmt(String(a));
    setPin("");
    setPinErr("");
    payKey.current = "";
    setPinSheet(true);
  };

  const onAmt = (raw: string) => {
    const v = raw.replace(/[^\d.]/g, "");
    const parts = v.split(".");
    const cleaned = parts.length > 1 ? parts[0] + "." + parts.slice(1).join("").slice(0, 2) : parts[0];
    setPayAmt(cleaned.slice(0, 9));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--ln)", background: "var(--bg)",
          padding: "calc(8px + var(--sat)) calc(12px + var(--sar)) 10px calc(8px + var(--sal))",
        }}
      >
        <button type="button" className="ib" onClick={back}><Icon n="back" s={20} /></button>
        <span className="av" style={{ background: "var(--pr)", color: "#fff", width: 40, height: 40 }}>{initials}</span>
        <span className="m">
          <b style={{ fontSize: 15 }}>{name}</b>
          <small>{sub}</small>
        </span>
        <button
          type="button"
          style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: 0.4, padding: "6px 4px" }}
          onClick={() => { loadCollectAndComplaints(); go("complaints"); }}
        >
          HELP
        </button>
      </div>

      <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", padding: "14px calc(14px + var(--sar)) 14px calc(14px + var(--sal))", display: "flex", flexDirection: "column", gap: 8 }}>
        {past.length === 0 ? (
          <div style={{ margin: "auto", textAlign: "center", padding: "0 10px" }}>
            <svg width="86" height="64" viewBox="0 0 86 64" fill="none" style={{ margin: "0 auto 14px", opacity: 0.55 }}>
              <rect x="2" y="2" width="56" height="40" rx="6" fill="var(--mu)" opacity="0.5" />
              <rect x="26" y="14" width="58" height="42" rx="6" fill="var(--cd)" stroke="var(--mu)" />
              <text x="34" y="42" fontSize="22" fill="var(--mu)">₹</text>
              <rect x="52" y="26" width="26" height="3" rx="1.5" fill="var(--mu)" />
              <rect x="52" y="33" width="26" height="3" rx="1.5" fill="var(--mu)" />
              <rect x="52" y="40" width="16" height="3" rx="1.5" fill="var(--mu)" />
            </svg>
            <p className="mu" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              You have not made any transaction with {short} on EkPay. Make your first transaction.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
              <button
                type="button"
                onClick={() => startPay(1)}
                style={{ border: "1px solid var(--tx)", borderRadius: 8, padding: "8px 16px", fontWeight: 600 }}
              >
                Send ₹1
              </button>
              <button
                type="button"
                onClick={() => showToast("Messaging abhi available nahi hai")}
                style={{ border: "1px solid var(--tx)", borderRadius: 8, padding: "8px 16px", fontWeight: 600 }}
              >
                Say &apos;Hi&apos; 👋
              </button>
            </div>
          </div>
        ) : (
          past.map((t: any, i: number) => (
            <div
              key={t.id + "_" + i}
              style={{
                alignSelf: t.cr ? "flex-start" : "flex-end", maxWidth: "75%", borderRadius: 14, padding: "8px 12px",
                background: t.cr ? "var(--cd)" : "var(--pr)", color: t.cr ? "var(--tx)" : "#fff",
                border: t.cr ? "1px solid var(--ln)" : "0",
              }}
            >
              <b style={{ fontSize: 16 }}>{inr(t.amt)}</b>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{t.cr ? "Received" : "Paid"} • {t.d}</div>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--ln)", background: "var(--bg)",
          padding: "10px calc(12px + var(--sar)) calc(10px + var(--sab)) calc(12px + var(--sal))",
        }}
      >
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "var(--cd)", border: "1px solid var(--ln)", borderRadius: 12, padding: "0 12px" }}>
          <b style={{ fontSize: 18 }}>₹</b>
          <input
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            autoFocus
            placeholder="Enter amount"
            value={payAmt}
            onChange={(e) => onAmt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") startPay(Number(payAmt)); }}
            style={{ border: 0, background: "transparent", outline: "none", margin: 0, padding: "13px 0", fontSize: 16 }}
          />
        </div>
        <button
          type="button"
          onClick={() => startPay(Number(payAmt))}
          style={{ background: "var(--tx)", color: "var(--bg)", borderRadius: 12, padding: "13px 28px", fontWeight: 700, fontSize: 14 }}
        >
          Pay
        </button>
      </div>
    </div>
  );
}
