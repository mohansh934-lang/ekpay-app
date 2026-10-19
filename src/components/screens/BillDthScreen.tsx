"use client";

import { inr } from "@/lib/format";
import { BrandLogo } from "@/components/BrandLogo";
import { DTH_PACKS } from "@/lib/constants";
import { useEk } from "@/context/EkContext";

export function BillDthScreen() {
  const {
    dthOp,
    setDthOp,
    dthId,
    setDthId,
    triggerCheckout,
  } = useEk();

  return (
    <>
      <div className="c p">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <BrandLogo brand={dthOp} size={42} />
          <div>
            <b>{dthOp} Recharge</b>
            <small style={{ display: "block" }}>Instant HD/SD Pack Activation</small>
          </div>
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          {Object.keys(DTH_PACKS).map((op) => (
            <button key={op} className={`chip ${dthOp === op ? "on" : ""}`} onClick={() => setDthOp(op)}>
              {op}
            </button>
          ))}
        </div>
        <small style={{ display: "block", marginTop: 8 }}>Subscriber ID / Smart Card No.</small>
        <input value={dthId} onChange={(e) => setDthId(e.target.value)} placeholder="10-digit Subscriber ID" />
      </div>

      <h3>{dthOp} Monthly Packs</h3>
      <div className="c">
        {DTH_PACKS[dthOp].map((pk, i) => (
          <div key={i} className="row">
            <BrandLogo brand={dthOp} size={36} />
            <span className="m">
              <b>{pk.name}</b>
              <small>{pk.ch} • Validity: {pk.val}</small>
            </span>
            <button
              className="chip on"
              onClick={() => triggerCheckout(`${dthOp} (${dthId})`, pk.price, pk.name)}
            >
              Pay {inr(pk.price)}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
