"use client";

import { inr } from "@/lib/format";
import { useEk } from "@/context/EkContext";

export function DoneScreen() {
  const {
    txns,
    tab,
    downloadReceipt,
  } = useEk();

  return (
    <div style={{ textAlign: "center", paddingTop: 20 }}>
      <div style={{ width: 68, height: 68, borderRadius: "50%", background: "var(--gr)", color: "#fff", display: "grid", placeItems: "center", fontSize: 32, margin: "0 auto 12px" }}>
        ✓
      </div>
      <b style={{ fontSize: 18 }}>Payment successful</b>
      <h1 style={{ fontSize: 36, margin: "6px 0" }}>{inr(txns[0].amt)}</h1>
      <p className="mu">Paid to {txns[0].n}</p>
      <div className="c" style={{ marginTop: 14 }}>
        <div className="row"><small className="m">Payment Mode</small><b>{txns[0].mode || "EkPay UPI"}</b></div>
        <div className="row"><small className="m">Debited From</small><b>{txns[0].bank}</b></div>
        <div className="row"><small className="m">UTR / Ref ID</small><b>{txns[0].ref}</b></div>
      </div>
      <button className="btn" onClick={() => tab("home")}>Done</button>
      <button className="btn o" onClick={() => downloadReceipt(txns[0])}>Download Receipt (.txt)</button>
    </div>
  );
}
