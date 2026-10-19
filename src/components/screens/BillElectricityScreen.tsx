"use client";

import { useEk } from "@/context/EkContext";

export function BillElectricityScreen() {
  const {
    elecBoard,
    setElecBoard,
    elecId,
    setElecId,
    triggerCheckout,
  } = useEk();

  return (
    <div className="c p">
      <b>Electricity Bill Payment (BBPS)</b>
      <small style={{ display: "block", marginTop: 10 }}>Select State Electricity Board</small>
      <select value={elecBoard} onChange={(e) => setElecBoard(e.target.value)}>
        <option>MPPKVVCL (Madhya Pradesh)</option>
        <option>MPMKVVCL (Bhopal / Central MP)</option>
        <option>MSEDCL (Maharashtra)</option>
        <option>BESCOM (Bengaluru)</option>
        <option>Tata Power / BSES Delhi</option>
        <option>UPPCL (Uttar Pradesh)</option>
      </select>
      <small style={{ display: "block", marginTop: 10 }}>IVRS / Consumer Number</small>
      <input value={elecId} onChange={(e) => setElecId(e.target.value)} placeholder="Enter Consumer / IVRS No." />

      <div className="c" style={{ marginTop: 14, background: "var(--bg)" }}>
        <div className="row"><small className="m">Consumer Name</small><b>Mohan Lal Verma</b></div>
        <div className="row"><small className="m">Bill Month</small><b>October 2026</b></div>
        <div className="row"><small className="m">Units Consumed</small><b>198 kWh</b></div>
        <div className="row"><small className="m">Bill Amount Due</small><b style={{ fontSize: 16 }}>₹1,420</b></div>
      </div>

      <button
        className="btn"
        onClick={() => triggerCheckout(elecBoard, 1420, `IVRS: ${elecId}`)}
      >
        Pay Electricity Bill (₹1,420)
      </button>
    </div>
  );
}
