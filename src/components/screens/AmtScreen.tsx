"use client";

import { inr } from "@/lib/format";
import { Icon } from "@/components/Icon";
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

  return (
    <div style={{ textAlign: "center", paddingTop: 4 }}>
      <div style={{ display: "inline-block" }}>
        <BrandLogo brand={contacts[payToIdx][0]} size={48} />
      </div>
      <p style={{ marginTop: 6, fontWeight: 600 }}>Paying {contacts[payToIdx][0]}</p>
      <small>{contacts[payToIdx][2]} • EkPay Verified ✓</small>
      <h1 style={{ fontSize: 40, fontWeight: 600, margin: "8px 0" }}>₹{payAmt || "0"}</h1>
      <input
        placeholder="Add a note (optional)"
        value={payNote}
        onChange={(e) => setPayNote(e.target.value)}
        style={{ maxWidth: 220, margin: "0 auto 8px", textAlign: "center", display: "block", padding: "7px 12px" }}
      />

      <div className="chips" style={{ justifyContent: "center" }}>
        <button className={`chip ${!useLite ? "on" : ""}`} onClick={() => setUseLite(false)}>
          🏦 Bank Account
        </button>
        <button className={`chip ${useLite ? "on" : ""}`} onClick={() => setUseLite(true)}>
          ⚡ UPI Lite ({inr(upiLiteBal)})
        </button>
      </div>

      {!useLite && (
        <button
          className="row"
          onClick={() => setPayBankIdx((payBankIdx + 1) % banks.length)}
          style={{ background: "var(--cd)", border: "1px solid var(--ln)", borderRadius: 14, padding: "9px 12px", margin: "6px 0" }}
        >
          <span className="it"><Icon n="bank" /></span>
          <span className="m">
            <b>{banks[payBankIdx][0]}</b>
            <small>Balance {hideBal ? "₹ ••••••" : inr(banks[payBankIdx][1])}</small>
          </span>
          <span className="mu">Switch Bank</span>
        </button>
      )}

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

      <button
        className="btn"
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
          if (a > banks[payBankIdx][1]) return showToast("Account me balance kam hai");
          setPin("");
          setPinErr("");
          payKey.current = "";
          setPinSheet(true);
        }}
      >
        {useLite && Number(payAmt) <= 500 ? "⚡ Instant Pay (No PIN)" : "Proceed to Pay"}
      </button>
    </div>
  );
}
