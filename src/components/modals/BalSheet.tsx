"use client";

import { inr } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { useEk } from "@/context/EkContext";

export function BalSheet() {
  const {
    checkedBalances,
    setBalCheckModal,
    setBalSheetOpen,
    setBalPinError,
    getLiveBanks,
  } = useEk();

  return (
    <div id="sh" onClick={() => setBalSheetOpen(false)}>
      <div className="sb" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <b>Select Bank to Check Balance</b>
          <button className="chip" onClick={() => setBalSheetOpen(false)}>Close</button>
        </div>
        <small className="mu" style={{ display: "block", marginBottom: 10 }}>
          Enter separate UPI PIN for the bank you want to view, or verify all banks one-by-one for Total Balance:
        </small>
        <div className="c">
          {getLiveBanks().map((b) => {
            const isUnlocked = checkedBalances[b.id] !== undefined;
            return (
              <div key={b.id} className="row">
                <span className="it"><Icon n="bank" /></span>
                <span className="m">
                  <b>{b.label}</b>
                  <small>{isUnlocked ? `Unlocked: ${inr(b.balance)}` : "Balance: ₹ ••••••"}</small>
                </span>
                <button
                  className="chip on"
                  onClick={() => {
                    setBalSheetOpen(false);
                    setBalPinError(""); setBalCheckModal({ id: b.id, label: b.label, pin: "" });
                  }}
                >
                  {isUnlocked ? "✓ Checked (View)" : "Check"}
                </button>
              </div>
            );
          })}
        </div>
        <button
          className="btn"
          style={{ marginTop: 12 }}
          onClick={() => {
            const all = getLiveBanks().map((b) => ({ id: b.id, label: b.label }));
            if (!all.length) return;
            setBalSheetOpen(false);
            setBalCheckModal({
              id: all[0].id,
              label: all[0].label,
              pin: "",
              queue: all.slice(1),
              step: 1,
              totalSteps: all.length,
            });
          }}
        >
          🔐 Check Total Balance (Verify All {getLiveBanks().length} Banks)
        </button>
      </div>
    </div>
  );
}
