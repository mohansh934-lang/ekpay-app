"use client";

import { useEk } from "@/context/EkContext";

export function BalPinModal() {
  const {
    setCheckedBalances,
    balCheckModal,
    setBalCheckModal,
    setHeroBalMode,
    setHeroSingleBankId,
    balPinBusy,
    setBalPinBusy,
    balPinError,
    setBalPinError,
    getLiveBanks,
    showToast,
  } = useEk();
  if (!balCheckModal) return null;

  const verify = async () => {
    if (balPinBusy) return;
    if (!(balCheckModal.pin || "").length) {
      showToast("Pehle UPI PIN daalo");
      return;
    }
    setBalPinBusy(true);
    try {
    const r = await fetch("/api/accounts/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankAccountId: balCheckModal.id, pin: balCheckModal.pin }),
    });
    const d = await r.json().catch(() => ({}));
    const liveBank = getLiveBanks().find((x) => x.id === balCheckModal.id);
    const okPin = r.ok;

    if (okPin && liveBank) {
      const latestBal = typeof d.balance === "number" ? d.balance : liveBank.balance;
      setCheckedBalances((prev) => ({ ...prev, [balCheckModal.id]: latestBal }));

      if (balCheckModal.queue && balCheckModal.queue.length > 0) {
        const [nextBank, ...rest] = balCheckModal.queue;
        setBalPinError("");
        setBalPinError("");
        setBalCheckModal({
          id: nextBank.id,
          label: nextBank.label,
          pin: "",
          queue: rest,
          step: (balCheckModal.step || 1) + 1,
          totalSteps: balCheckModal.totalSteps,
        });
      } else if (balCheckModal.totalSteps) {
        setHeroBalMode("total");
        setHeroSingleBankId(null);
        setBalCheckModal(null);
        setBalPinError("");
      } else {
        setHeroSingleBankId(null);
        setHeroBalMode("total"); // unlocked banks ka sum dikhao
        setBalCheckModal(null);
        setBalPinError("");
      }
    } else {
      const errMsg = d?.error?.message || "Wrong UPI PIN";
      const left = d?.error?.remainingAttempts;
      setBalPinError(left !== undefined ? `Wrong UPI PIN • ${left} attempts left` : "Wrong UPI PIN");
      setBalCheckModal({ ...balCheckModal, pin: "" }); // clear PIN boxes
    }
    } finally {
      setBalPinBusy(false);
    }
  };

  return (
    <div id="sh">
      <div className="sb" style={{ textAlign: "center", position: "relative" }}>
        <button type="button" aria-label="Close" onClick={() => { setBalCheckModal(null); setBalPinBusy(false); setBalPinError(""); }} style={{ position: "absolute", top: 0, right: 0, padding: "4px 10px", fontSize: 22, lineHeight: 1, background: "none", color: "inherit", opacity: 0.7 }}>✕</button>
        {balCheckModal.totalSteps ? (
          <span className="chip on" style={{ fontSize: 11, marginBottom: 8, display: "inline-block" }}>
            Total Balance • Bank {balCheckModal.step} of {balCheckModal.totalSteps}
          </span>
        ) : null}
        <b style={{ display: "block", fontSize: 16 }}>Enter UPI PIN for {balCheckModal.label}</b>
        {balCheckModal.totalSteps ? (
          <p className="mu" style={{ fontSize: 12 }}>
            {`Line-by-Line PIN (${balCheckModal.step}/${balCheckModal.totalSteps}): Verify ${balCheckModal.label}`}
          </p>
        ) : null}
        {/* Real UPI style 4 PIN boxes */}
        <div
          style={{ display: "flex", justifyContent: "center", gap: 14, margin: "18px 0 14px" }}
          onClick={() => document.getElementById("bal-pin-hidden")?.focus()}
        >
          {[0, 1, 2, 3].map((i) => {
            const len = (balCheckModal.pin || "").length;
            const filled = len > i;
            const active = len === i;
            return (
              <div
                key={i}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  border: active ? "2px solid var(--pr)" : "2px solid var(--ln)",
                  background: filled ? "var(--pr)" : "var(--card)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#fff",
                  boxShadow: active ? "0 0 0 4px rgba(232,26,108,.22)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {filled ? "•" : ""}
              </div>
            );
          })}
        </div>
        <input
          key={String(balCheckModal.id) + "-" + String(balCheckModal.step || 0)}
          id="bal-pin-hidden"
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoFocus
          autoComplete="off"
          value={balCheckModal.pin || ""}
          onChange={(e) => {
            const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 4);
            setBalPinError("");
            setBalCheckModal({ ...balCheckModal, pin: onlyDigits });
          }}
          style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
        />
        <div className="kp" style={{ margin: "8px auto 4px", maxWidth: 280 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Check"].map((k) => (
            <button
              key={k}
              type="button"
              disabled={k === "Check" && balPinBusy}
              onClick={() => {
                if (k === "Check") verify();
                else if (k === "⌫") setBalCheckModal({ ...balCheckModal, pin: (balCheckModal.pin || "").slice(0, -1) });
                else if ((balCheckModal.pin || "").length < 4) setBalCheckModal({ ...balCheckModal, pin: (balCheckModal.pin || "") + k });
              }}
              className={k === "Check" ? "btn" : undefined}
              style={k === "Check" ? { margin: "0 6px", padding: "12px 0", fontSize: 14, alignSelf: "center", width: "auto", borderRadius: 999 } : undefined}
            >
              {k === "Check" ? (balPinBusy ? "…" : balCheckModal.queue && balCheckModal.queue.length > 0 ? "Next →" : "Check") : k}
            </button>
          ))}
        </div>
                    {balPinError ? (
          <p style={{ color: "var(--rd, #ef4444)", fontSize: 12.5, margin: "4px 0 10px", fontWeight: 600, textAlign: "center" }}>
            {balPinError}
          </p>
        ) : (
          <div style={{ height: 22 }} />
        )}
      </div>
    </div>
  );
}
