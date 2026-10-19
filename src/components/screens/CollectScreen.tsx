"use client";

import { inr } from "@/lib/format";
import { useEk } from "@/context/EkContext";

export function CollectScreen() {
  const {
    collectVpa,
    setCollectVpa,
    collectAmt,
    setCollectAmt,
    collectNote,
    setCollectNote,
    collectList,
    collectPinMap,
    setCollectPinMap,
    refreshServerState,
    loadCollectAndComplaints,
    showToast,
  } = useEk();

  return (
    <>
      <div className="c p">
        <b>📥 Request Money (UPI Collect)</b>
        <small style={{ display: "block", marginTop: 2 }}>Enter friend's EkPay UPI ID to request payment</small>
        <input
          placeholder="Payer UPI ID (e.g. 9876500002@ekpay)"
          value={collectVpa}
          onChange={(e) => setCollectVpa(e.target.value.trim())}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input
            type="number"
            placeholder="Amount ₹"
            value={collectAmt}
            onChange={(e) => setCollectAmt(e.target.value)}
          />
          <input
            placeholder="Note (e.g. Dinner split)"
            value={collectNote}
            onChange={(e) => setCollectNote(e.target.value)}
          />
        </div>
        <button
          className="btn"
          onClick={async () => {
            const r = await fetch("/api/collect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payerVpa: collectVpa, amount: Number(collectAmt), note: collectNote || undefined }),
            });
            const d = await r.json();
            if (r.ok) {
              setCollectVpa("");
              setCollectAmt("");
              setCollectNote("");
              await loadCollectAndComplaints();
              showToast("Collect request sent!");
            } else {
              showToast(d?.error?.message || "Failed to send request");
            }
          }}
        >
          Send Collect Request
        </button>
      </div>

      <h3>Incoming Requests (Pay / Decline)</h3>
      <div className="c">
        {collectList.incoming.length === 0 ? (
          <div className="row"><small className="m">No incoming collect requests</small></div>
        ) : (
          collectList.incoming.map((req) => (
            <div key={req.id} className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>{req.requester.name} requested {inr(req.amount)}</b>
                <span className="chip on" style={{ fontSize: 10.5, padding: "2px 8px" }}>{req.status}</span>
              </div>
              <small>{req.note || req.requester.upiId}</small>
              {req.status === "pending" && (
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="UPI PIN"
                    value={collectPinMap[req.id] || ""}
                    onChange={(e) => setCollectPinMap({ ...collectPinMap, [req.id]: e.target.value.replace(/\D/g, "") })}
                    style={{ marginTop: 0, maxWidth: 110 }}
                  />
                  <button
                    className="chip on"
                    onClick={async () => {
                      const r = await fetch(`/api/collect/${req.id}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "approve", pin: collectPinMap[req.id] || "" }),
                      });
                      const d = await r.json();
                      if (r.ok) {
                        await loadCollectAndComplaints();
                        await refreshServerState();
                        showToast("Collect Approved & Paid!");
                      } else {
                        showToast(d?.error?.message || "Approval failed");
                      }
                    }}
                  >
                    Approve & Pay
                  </button>
                  <button
                    className="chip"
                    onClick={async () => {
                      await fetch(`/api/collect/${req.id}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "decline" }),
                      });
                      await loadCollectAndComplaints();
                      showToast("Request Declined");
                    }}
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <h3>Sent Requests (Outgoing)</h3>
      <div className="c">
        {collectList.outgoing.length === 0 ? (
          <div className="row"><small className="m">No sent requests yet</small></div>
        ) : (
          collectList.outgoing.map((req) => (
            <div key={req.id} className="row">
              <span className="m">
                <b>{inr(req.amount)} from {req.payer.name}</b>
                <small>{req.payer.upiId} • {req.status}</small>
              </span>
              {req.status === "pending" && (
                <button
                  className="chip"
                  onClick={async () => {
                    await fetch(`/api/collect/${req.id}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "cancel" }),
                    });
                    await loadCollectAndComplaints();
                    showToast("Cancelled");
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
