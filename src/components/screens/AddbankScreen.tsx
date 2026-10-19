"use client";

import { Icon } from "@/components/Icon";
import { useEk } from "@/context/EkContext";

export function AddbankScreen() {
  const {
    sessionUser,
    npciBanks,
    bankQuery,
    setBankQuery,
    pickedBank,
    setPickedBank,
    discoveredAccs,
    setDiscoveredAccs,
    refreshServerState,
    searchNpciBanks,
    showToast,
    pushNotif,
    go,
  } = useEk();

  return (
    <>
      <div className="c p">
        <b>🏦 Link Bank Account via Mobile Number</b>
        <small style={{ display: "block", marginTop: 2 }}>
          Fetching accounts linked to +91 {sessionUser?.phone || "9876500001"}
        </small>
        <input
          placeholder="Search 90+ UPI Live Banks (e.g. Axis, SBI, Kotak, Gramin)..."
          value={bankQuery}
          onChange={(e) => {
            setBankQuery(e.target.value);
            searchNpciBanks(e.target.value);
          }}
        />
      </div>

      {pickedBank && (
        <div className="c p" style={{ borderColor: "var(--pr)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>{pickedBank.name}</b>
            <button className="chip" onClick={() => { setPickedBank(null); setDiscoveredAccs(null); }}>Close</button>
          </div>
          {discoveredAccs === null ? (
            <small style={{ display: "block", marginTop: 8 }}>Discovering accounts with NPCI ListAccount...</small>
          ) : discoveredAccs.length === 0 ? (
            <small style={{ display: "block", marginTop: 8 }}>No account found in this bank.</small>
          ) : (
            discoveredAccs.map((acc) => (
              <div key={acc.last4} className="row" style={{ marginTop: 6 }}>
                <span className="it"><Icon n="bank" /></span>
                <span className="m">
                  <b>{acc.type} Account • {acc.maskedNumber}</b>
                  <small>IFSC: {acc.ifsc}</small>
                </span>
                <button
                  className="chip on"
                  onClick={async () => {
                    const r = await fetch("/api/accounts/link", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ bankId: pickedBank.id, last4: acc.last4 }),
                    });
                    const d = await r.json();
                    if (r.ok) {
                      await refreshServerState();
                      setPickedBank(null);
                      setDiscoveredAccs(null);
                      pushNotif("Bank Linked ✓", `${d.account.label} linked to your EkPay UPI`);
                      go("profile");
                    } else {
                      showToast(d?.error?.message || "Could not link bank");
                    }
                  }}
                >
                  Link Account
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <h3>Select Your Bank ({npciBanks.length} UPI Banks)</h3>
      <div className="c">
        {npciBanks.map((b) => (
          <button
            key={b.id}
            className="row"
            onClick={async () => {
              setPickedBank(b);
              setDiscoveredAccs(null);
              const r = await fetch("/api/banks/discover", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bankId: b.id }),
              });
              const d = await r.json();
              if (r.ok) setDiscoveredAccs(d.accounts || []);
              else showToast(d?.error?.message || "Discovery failed");
            }}
          >
            <span className="it"><Icon n="bank" /></span>
            <span className="m">
              <b>{b.name}</b>
              <small style={{ textTransform: "capitalize" }}>{b.category.replace("_", " ")} Bank</small>
            </span>
            {b.popular ? <span className="chip on" style={{ fontSize: 10.5, padding: "3px 8px" }}>★ Popular</span> : <span className="mu">Link →</span>}
          </button>
        ))}
      </div>
    </>
  );
}
