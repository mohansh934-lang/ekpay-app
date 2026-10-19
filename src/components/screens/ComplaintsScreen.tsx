"use client";

import { inr } from "@/lib/format";
import { useEk } from "@/context/EkContext";

export function ComplaintsScreen() {
  const {
    complaintsList,
  } = useEk();

  return (
    <>
      <div className="c p">
        <b>🛡️ EkPay UPI Dispute Resolution Center</b>
        <small style={{ display: "block", marginTop: 4 }}>
          Tap any transaction in Passbook to raise a complaint. Tickets auto-progress from Open → In Review → Resolved.
        </small>
      </div>
      <h3>Your Active & Past Tickets ({complaintsList.length})</h3>
      <div className="c">
        {complaintsList.length === 0 ? (
          <div className="row"><small className="m">No complaints raised yet.</small></div>
        ) : (
          complaintsList.map((c) => (
            <div key={c.id} className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>Ticket #{c.ticket}</b>
                <span className="chip on" style={{ fontSize: 10.5, padding: "2px 8px" }}>{c.status.replace("_", " ")}</span>
              </div>
              <small>{c.category.replace(/_/g, " ")} • {inr(c.transaction.amount)} to {c.transaction.counterparty}</small>
              <small style={{ color: "var(--tx)" }}>"{c.description}"</small>
              {c.resolution && <small className="cr">✓ {c.resolution}</small>}
            </div>
          ))
        )}
      </div>
    </>
  );
}
