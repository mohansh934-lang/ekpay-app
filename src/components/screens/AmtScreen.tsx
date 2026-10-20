"use client";

import { useState } from "react";
import { inr } from "@/lib/format";
import { BrandLogo } from "@/components/BrandLogo";
import { useEk } from "@/context/EkContext";

export function AmtScreen() {
  const {
    upiLiteBal,
    payBusy,
    setPayBusy,
    setPinErr,
    payKey,
    setNavHist,
    contacts,
    banks,
    hideBal,
    payToIdx,
    payAmt,
    setPayAmt,
    payNote,
    setPayNote,
    payBankIdx,
    setPayBankIdx,
    useLite,
    setUseLite,
    setPinSheet,
    setPin,
    tone,
    showToast,
    pushNotif,
    newKey,
    apiCall,
    loadAll,
  } = useEk();

  const [showBanks, setShowBanks] = useState(false);

  const isBill = contacts[payToIdx]?.[1] === "Verified Bill/Merchant";
  const safeBankIdx = banks.length ? Math.min(payBankIdx, banks.length - 1) : 0;

  return (
    <div style={{ textAlign: "center", paddingTop: 4 }}>
      <div style={{ display: "inline-block" }}>
        <BrandLogo brand={contacts[payToIdx][0]} size={48} />
      </div>
      <p style={{ marginTop: 6, fontWeight: 600 }}>Paying {contacts[payToIdx][0]}</p>
      <small>{contacts[payToIdx][2]} • EkPay Verified ✓</small>
      <h1 style={{ fontSize: 40, fontWeight: 600, margin: isBill ? "4px 0" : "8px 0" }}>₹{payAmt || "0"}</h1>
      {isBill ? (
        payNote ? (
          <div style={{ background: "var(--cd)", border: "1px solid var(--ln)", borderRadius: 14, padding: "10px 14px", margin: "0 auto 8px", maxWidth: 320, textAlign: "left" }}>
            <small className="mu" style={{ display: "block", marginBottom: 2 }}>Details</small>
            <span style={{ fontSize: 13.5, lineHeight: 1.45, whiteSpace: "normal", wordBreak: "break-word" }}>{payNote}</span>
          </div>
        ) : null
      ) : (
        <input
          placeholder="Add a note (optional)"
          value={payNote}
          onChange={(e) => setPayNote(e.target.value)}
          style={{ maxWidth: 220, margin: "0 auto 8px", textAlign: "center", display: "block", padding: "7px 12px" }}
        />
      )}

      <div className="chips" style={{ justifyContent: "center" }}>
        <button className={`chip ${!useLite ? "on" : ""}`} onClick={() => { setUseLite(false); setShowBanks(false); }}>
          Bank Account
        </button>
        <button className={`chip ${useLite ? "on" : ""}`} onClick={() => { setUseLite(true); setShowBanks(false); }}>
          UPI Lite ({inr(upiLiteBal)})
        </button>
      </div>

      {!useLite && banks.length > 0 && (
        <div style={{ textAlign: "left", margin: isBill ? "4px 0 8px" : "6px 0 8px" }}>
          <button
            type="button"
            className="row"
            onClick={() => setShowBanks((v) => !v)}
            style={{ background: "var(--cd)", border: "1px solid var(--ln)", borderRadius: 14, padding: isBill ? "14px 12px" : "10px 12px", width: "100%" }}
          >
            <BrandLogo brand={banks[safeBankIdx][0]} size={38} />
            <span className="m">
              <b>{banks[safeBankIdx][0]}</b>
              <small>Balance {hideBal ? "Rs hidden" : inr(banks[safeBankIdx][1])}</small>
            </span>
            <span className="mu" style={{ fontWeight: 600, color: "var(--pr)" }}>
              {showBanks ? "Close" : "Change"}
            </span>
          </button>
          {showBanks && (
            <div className="c" style={{ marginTop: 8, border: "1px solid var(--ln)", borderRadius: 14, overflow: "hidden" }}>
              {banks.map((b, i) => (
                <button
                  key={b[0] + i}
                  type="button"
                  className="row"
                  onClick={() => {
                    setPayBankIdx(i);
                    setShowBanks(false);
                    tone(620, 0.04);
                    showToast("Paying from " + b[0]);
                  }}
                  style={{
                    background: i === safeBankIdx ? "rgba(232,26,108,0.08)" : "var(--cd)",
                    borderBottom: i < banks.length - 1 ? "1px solid var(--ln)" : "none",
                    borderRadius: 0,
                    padding: "12px",
                  }}
                >
                  <BrandLogo brand={b[0]} size={36} />
                  <span className="m">
                    <b>{b[0]}</b>
                    <small>{hideBal ? "Rs hidden" : inr(b[1])}</small>
                  </span>
                  {i === safeBankIdx && <b className="cr">Selected</b>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!isBill && (
        <div className="kp">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
            <button
              key={k}
              onClick={() => {
                tone(600, 0.03);
                if (k === "⌫") setPayAmt((p) => p.slice(0, -1));
                else if (k === ".") {
                  if (payAmt && !payAmt.includes(".")) setPayAmt((p) => p + ".");
                } else if (payAmt.length < 7) setPayAmt((p) => p + k);
              }}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      <button
        className="btn"
        style={isBill ? { marginTop: 8, padding: "15px" } : undefined}
        onClick={() => {
          const a = Number(payAmt);
          if (!a) return showToast("Amount daalo");
          if (useLite) {
            if (a > 500) return showToast("UPI Lite max limit is ₹500 per txn");
            if (a > upiLiteBal) return showToast("UPI Lite balance kam hai");
            if (payBusy) return;
            setPayBusy(true);
            (async () => {
              const r = await apiCall("POST", "/api/payments", {
                amount: a,
                receiver: contacts[payToIdx][0].slice(0, 80),
                method: "lite",
                note: payNote ? payNote.slice(0, 100) : undefined,
                category: "Transfer",
                idempotencyKey: newKey(),
              });
              setPayBusy(false);
              if (!r.ok) return showToast(r.message);
              await loadAll();
              pushNotif("Paid via UPI Lite (No PIN)", `${inr(a)} debited from UPI Lite`);
              setPayAmt("");
              setPayNote("");
              setNavHist(["home", "done"]);
            })();
            return;
          }
          if (!banks.length) return showToast("Pehle bank link karo");
          if (a > banks[safeBankIdx][1]) return showToast("Account me balance kam hai");
          if (payBankIdx !== safeBankIdx) setPayBankIdx(safeBankIdx);
          setPin("");
          setPinErr("");
          payKey.current = "";
          setPinSheet(true);
        }}
      >
        {useLite && Number(payAmt) <= 500 ? "Instant Pay (No PIN)" : "Proceed to Pay"}
      </button>
    </div>
  );
}
