"use client";

import { BrandLogo } from "../BrandLogo";
import { inr } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { useEk } from "@/context/EkContext";

export function ProfileScreen() {
  const {
    upiLiteBal,
    checkedBalances,
    setBalCheckModal,
    setBalPinError,
    refreshServerState,
    searchNpciBanks,
    getLiveBanks,
    showToast,
    go,
    myName,
    myUpi,
    myPhone,
    initials,
  } = useEk();

  return (
    <>
      <div className="c p" style={{ textAlign: "center" }}>
        <span className="av" style={{ width: 62, height: 62, background: "#fce7f0", color: "#9d1048", fontSize: 22, margin: "0 auto 8px" }}>
          {initials}
        </span>
        <b style={{ fontSize: 17 }}>{myName}</b>
        <p className="mu">UPI ID: {myUpi} • {myPhone}</p>

        {/* Personal Receive QR Code right inside Profile! */}
        <svg viewBox="0 0 120 120" width="148" height="148" style={{ margin: "12px auto 8px", background: "#fff", padding: 8, borderRadius: 12, border: "1px solid var(--ln)" }}>
          <rect x="10" y="10" width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="6" />
          <rect x="80" y="10" width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="6" />
          <rect x="10" y="80" width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="6" />
          <rect x="20" y="20" width="10" height="10" fill="#e81a6c" />
          <rect x="90" y="20" width="10" height="10" fill="#e81a6c" />
          <rect x="20" y="90" width="10" height="10" fill="#e81a6c" />
          <path d="M50 20h10v20H50zM50 50h20v20H50zM80 50h20v10H80zM50 80h15v25H50zM75 75h30v30H75z" fill="#0f172a" />
        </svg>
        <small style={{ display: "block" }}>Scan with any UPI app to pay {myName}</small>
      </div>

      <h3>My Payment Methods & Wallets</h3>
      <div className="c">
        <button className="row" onClick={() => go("upilite")}>
          <span className="it"><Icon n="rup" /></span>
          <span className="m">
            <b>⚡ UPI Lite (Pin-less Wallet)</b>
            <small>Instant payments up to ₹500 without PIN</small>
          </span>
          <b className="cr">{inr(upiLiteBal)} →</b>
        </button>
        <button className="row" onClick={() => go("autopay")}>
          <span className="it"><Icon n="rec" /></span>
          <span className="m">
            <b>OTT Subscriptions & Autopay</b>
            <small>JioHotstar, Netflix, Prime Video, Crunchyroll, ZEE5, SonyLIV</small>
          </span>
          <span className="mu">Manage →</span>
        </button>
                  
      </div>

      <h3>Linked Bank Accounts <button onClick={() => { searchNpciBanks(""); go("addbank"); }}>+ Add Bank</button></h3>
      <div className="c">
        {getLiveBanks().map((b, i) => (
          <div key={b.id || i} className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BrandLogo name={b.label} size={38} />
              <span className="m">
                <b>{b.label} {b.isPrimary && <small className="cr">(Primary)</small>}</b>
                <small>
                  {checkedBalances[b.id] !== undefined ? `Verified Live Balance: ${inr(b.balance)}` : "Balance: ₹ •••••• (Tap Check Bal)"}
                </small>
              </span>
              <button
                className="chip on"
                onClick={() => { setBalPinError(""); setBalCheckModal({ id: b.id, label: b.label, pin: "" }); }}
              >
                Check Bal
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, paddingLeft: 46 }}>
              {!b.isPrimary && (
                <button
                  className="chip"
                  style={{ fontSize: 11, padding: "4px 9px" }}
                  onClick={async () => {
                    const r = await fetch("/api/accounts/primary", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ bankAccountId: b.id }),
                    });
                    if (r.ok) {
                      await refreshServerState();
                      showToast(b.label + " set as Primary!");
                    }
                  }}
                >
                  Make Primary
                </button>
              )}
              <button
                className="chip"
                style={{ fontSize: 11, padding: "4px 9px" }}
                onClick={async () => {
                  await fetch("/api/accounts/deposit", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bankAccountId: b.id, amount: 10000 }),
                  });
                  await refreshServerState();
                  showToast("₹10,000 credited to " + b.label);
                }}
              >
                + Deposit ₹10k
              </button>
              <button
                className="chip"
                style={{ fontSize: 11, padding: "4px 9px", color: "var(--rd)" }}
                onClick={async () => {
                  const r = await fetch(`/api/accounts/${b.id}`, { method: "DELETE" });
                  const d = await r.json();
                  if (r.ok) {
                    await refreshServerState();
                    showToast("Bank account unlinked");
                  } else {
                    showToast(d?.error?.message || "Cannot unlink");
                  }
                }}
              >
                Unlink
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
