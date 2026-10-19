"use client";

import { inr } from "@/lib/format";
import { useEk } from "@/context/EkContext";

export function BillFastagScreen() {
  const {
    fastagBank,
    setFastagBank,
    vehNo,
    setVehNo,
    fastagAmt,
    setFastagAmt,
    triggerCheckout,
  } = useEk();

  return (
    <div className="c p">
      <b>🚗 NHAI FASTag Instant Recharge</b>
      <small style={{ display: "block", marginTop: 10 }}>Select FASTag Issuing Bank</small>
      <select value={fastagBank} onChange={(e) => setFastagBank(e.target.value)}>
        <option>ICICI Bank FASTag</option>
        <option>HDFC Bank FASTag</option>
        <option>SBI FASTag</option>
        <option>Axis Bank FASTag</option>
      </select>
      <small style={{ display: "block", marginTop: 10 }}>Vehicle Registration Number</small>
      <input
        value={vehNo}
        onChange={(e) => setVehNo(e.target.value.toUpperCase())}
        placeholder="e.g. MP 04 CJ 7721"
      />
      <small style={{ display: "block", marginTop: 10 }}>Select Top-up Amount</small>
      <div className="chips">
        {[300, 500, 1000, 2000].map((a) => (
          <button key={a} className={`chip ${fastagAmt === a ? "on" : ""}`} onClick={() => setFastagAmt(a)}>
            ₹{a}
          </button>
        ))}
      </div>
      <button
        className="btn"
        onClick={() => triggerCheckout(`FASTag (${vehNo})`, fastagAmt, fastagBank)}
      >
        Recharge FASTag ({inr(fastagAmt)})
      </button>
    </div>
  );
}
