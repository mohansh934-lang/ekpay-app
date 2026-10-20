"use client";

import { inr } from "@/lib/format";
import { BrandLogo } from "@/components/BrandLogo";
import { useEk } from "@/context/EkContext";

export function TxnScreen() {
  const {
    compCat,
    setCompCat,
    compDesc,
    setCompDesc,
    loadCollectAndComplaints,
    txns,
    showToast,
    go,
    downloadReceipt,
    subParam,
  } = useEk();

  const t = txns[Number(subParam)] || txns[0];
  return (
    <>
      <div style={{ textAlign: "center", padding: "20px 0 12px" }}>
        <div style={{ display: "inline-block" }}>
          <BrandLogo brand={t.n} size={58} />
        </div>
        <p style={{ marginTop: 10, fontWeight: 500 }}>{t.cr ? "Received from" : "Paid to"} {t.n}</p>
        <h1 style={{ fontSize: 34, fontWeight: 600, margin: "4px 0" }} className={t.cr ? "cr" : ""}>
          {inr(t.amt)}
        </h1>
        <p className="cr" style={{ fontWeight: 500 }}>✓ Completed • {t.d}</p>
      </div>
      <div className="c">
        <div className="row"><small className="m">Payment Mode</small><b style={{ fontSize: 13 }}>{t.mode || "EkPay UPI"}</b></div>
        <div className="row"><small className="m">Bank / Wallet</small><b style={{ fontSize: 13 }}>{t.bank}</b></div>
        <div className="row"><small className="m">Category</small><b style={{ fontSize: 13 }}>{t.cat}</b></div>
        <div className="row"><small className="m">UTR / Ref ID</small><b style={{ fontSize: 13 }}>{t.ref}</b></div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" onClick={() => downloadReceipt(t)}>Download Receipt</button>
        <button className="btn o" onClick={() => go("split")}>Split Bill</button>
      </div>
      <div className="c p" style={{ marginTop: 12 }}>
        <b>Have an issue with this transaction?</b>
        <small style={{ display: "block", marginBottom: 8 }}>Raise an official NPCI / EkPay dispute ticket</small>
        <select value={compCat} onChange={(e) => setCompCat(e.target.value)} style={{ marginBottom: 8 }}>
          <option value="debited_not_received">Amount debited but not received by payee</option>
          <option value="failed_but_debited">Transaction failed but money deducted</option>
          <option value="pending_too_long">Transaction stuck in Pending state</option>
          <option value="wrong_payee">Sent to wrong UPI ID / account</option>
          <option value="duplicate_charge">Paid twice (Duplicate charge)</option>
          <option value="other">Other UPI issue</option>
        </select>
        <input
          placeholder="Describe issue (min 10 chars)..."
          value={compDesc}
          onChange={(e) => setCompDesc(e.target.value)}
        />
        <button
          className="btn"
          onClick={async () => {
            if (compDesc.trim().length < 10) return showToast("Please write at least 10 characters");
            const r = await fetch("/api/complaints", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ txnId: t.id, category: compCat, description: compDesc.trim() }),
            });
            const d = await r.json();
            if (r.ok) {
              setCompDesc("");
              await loadCollectAndComplaints();
              showToast(`Ticket Raised: ${d.complaint.ticket}`);
              go("complaints");
            } else {
              showToast(d?.error?.message || "Could not raise complaint");
            }
          }}
        >
          Raise UPI Dispute Ticket
        </button>
      </div>
    </>
  );
}
