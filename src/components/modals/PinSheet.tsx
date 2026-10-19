"use client";

import { inr } from "@/lib/format";
import { useEk } from "@/context/EkContext";

export function PinSheet() {
  const {
    payBusy,
    pinErr,
    setPinErr,
    payKey,
    contacts,
    banks,
    payToIdx,
    payAmt,
    payBankIdx,
    setPinSheet,
    pin,
    handlePinKey,
  } = useEk();

  return (
    <div id="sh">
      <div className="sb" style={{ textAlign: "center" }}>
        <small>Paying {contacts[payToIdx][0]}</small>
        <h2 style={{ margin: "4px 0" }}>{inr(Number(payAmt))}</h2>
        <small>{banks[payBankIdx][0]} • EkPay Secure UPI</small>
        <div className="dots">
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className={i < pin.length ? "f" : ""}></i>
          ))}
        </div>
        {pinErr ? <small style={{ color: "var(--rd)" }}>{pinErr}</small> : <small>{payBusy ? "Verifying…" : "Enter 4-digit EkPay UPI PIN"}</small>}
        <div className="kp">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
            <button key={k} onClick={() => handlePinKey(k)}>{k}</button>
          ))}
        </div>
        <button className="btn o" onClick={() => { setPinSheet(false); setPinErr(""); payKey.current = ""; }}>Cancel</button>
      </div>
    </div>
  );
}
