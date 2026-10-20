"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { useEk } from "@/context/EkContext";

export function BillGasScreen() {
  const {
    gasOp,
    setGasOp,
    gasId,
    setGasId,
    triggerCheckout,
  } = useEk();

  return (
    <div className="c p">
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <BrandLogo brand={gasOp} size={42} />
        <div>
          <b>Book 14.2 kg LPG Cylinder</b>
          <small style={{ display: "block" }}>{gasOp}</small>
        </div>
      </div>
      <div className="chips" style={{ marginTop: 8 }}>
        {["Indane Gas (IndianOil)", "Bharat Gas", "HP Gas"].map((g) => (
          <button key={g} className={`chip ${gasOp === g ? "on" : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setGasOp(g)}>
            <BrandLogo brand={g} size={20} radius={6} />{g.split(" ")[0]}
          </button>
        ))}
      </div>
      <small style={{ display: "block", marginTop: 10 }}>Registered Mobile or 17-Digit LPG ID</small>
      <input value={gasId} onChange={(e) => setGasId(e.target.value)} />

      <div className="c" style={{ marginTop: 14, background: "var(--bg)" }}>
        <div className="row"><small className="m">Distributor</small><b>Bhopal Gas Agency</b></div>
        <div className="row"><small className="m">Refill Price</small><b style={{ fontSize: 16 }}>₹809</b></div>
      </div>

      <button
        className="btn"
        onClick={() => triggerCheckout(gasOp, 809, `LPG ID: ${gasId}`)}
      >
        Book & Pay Refill (₹809)
      </button>
    </div>
  );
}
