"use client";

import { useState } from "react";
import { inr } from "@/lib/format";
import { Icon } from "@/components/Icon";
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

  // PIN sahi hone ke baad isi screen par bank + balance dikhane ke liye
  const [result, setResult] = useState<{ label: string; balance: number; isPrimary: boolean } | null>(null);

  if (!balCheckModal) return null;

  const closePin = () => {
    setBalCheckModal(null);
    setBalPinBusy(false);
    setBalPinError("");
  };

  // Balance screen band hone par hi home par balance update hota hai
  const closeResult = () => {
    setHeroSingleBankId(null);
    setHeroBalMode("total");
    closePin();
  };

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

      if (r.ok && liveBank) {
        const latestBal = typeof d.balance === "number" ? d.balance : liveBank.balance;
        setCheckedBalances((prev) => ({ ...prev, [balCheckModal.id]: latestBal }));
        setBalPinError("");

        if (balCheckModal.queue && balCheckModal.queue.length > 0) {
          // "sab banks check karo" flow: agla bank
          const [nextBank, ...rest] = balCheckModal.queue;
          setBalCheckModal({
            id: nextBank.id,
            label: nextBank.label,
            pin: "",
            queue: rest,
            step: (balCheckModal.step || 1) + 1,
            totalSteps: balCheckModal.totalSteps,
          });
        } else if (balCheckModal.totalSteps) {
          // "sab banks" flow ka aakhri step: pehle jaisa, seedha home par total
          setHeroBalMode("total");
          setHeroSingleBankId(null);
          closePin();
        } else {
          // single bank: isi screen par bank details + balance dikhao
          setResult({ label: liveBank.label, balance: latestBal, isPrimary: !!liveBank.isPrimary });
        }
      } else {
        const left = d?.error?.remainingAttempts;
        setBalPinError(left !== undefined ? `Wrong UPI PIN • ${left} attempts left` : "Wrong UPI PIN");
        setBalCheckModal({ ...balCheckModal, pin: "" }); // PIN boxes clear
      }
    } finally {
      setBalPinBusy(false);
    }
  };

  return (
    <div id="sh" style={{ background: "var(--bg)", justifyContent: "flex-start", zIndex: 30 }}>
      <div
        className="sb"
        style={{
          textAlign: "center",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          maxHeight: "none",
          borderRadius: 0,
          background: "var(--bg)",
          padding: "16px 16px 20px",
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={result ? closeResult : closePin}
          style={{ position: "absolute", top: 12, right: 12, padding: "4px 10px", fontSize: 24, lineHeight: 1, background: "none", color: "inherit", opacity: 0.7, zIndex: 2 }}
        >
          ✕
        </button>

        {result ? (
          <div style={{ marginTop: 72, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: 68, height: 68, borderRadius: "50%", background: "var(--pr)", color: "#fff", display: "grid", placeItems: "center", marginBottom: 8 }}>
              <Icon n="bank" />
            </div>
            <b style={{ fontSize: 17 }}>{result.label}</b>
            {result.isPrimary ? <span className="chip on" style={{ fontSize: 11 }}>Primary account</span> : null}
            <small className="mu" style={{ marginTop: 22 }}>Available balance</small>
            <h1 style={{ fontSize: 38, fontWeight: 600, letterSpacing: -1 }}>{inr(result.balance)}</h1>
            <small className="mu">Balance checked successfully ✓</small>
          </div>
        ) : (
          <>
            <span style={{ position: "absolute", top: 18, left: 16, fontSize: 13, fontWeight: 600, opacity: 0.75 }}>Payments secured by UPI</span>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div>
              {balCheckModal.totalSteps ? (
                <span className="chip on" style={{ fontSize: 11, marginBottom: 8, display: "inline-block" }}>
                  Total Balance • Bank {balCheckModal.step} of {balCheckModal.totalSteps}
                </span>
              ) : null}
              <b style={{ display: "block", fontSize: 17 }}>Enter UPI PIN for {balCheckModal.label}</b>
              {balCheckModal.totalSteps ? (
                <p className="mu" style={{ fontSize: 12 }}>
                  {`Line-by-Line PIN (${balCheckModal.step}/${balCheckModal.totalSteps}): Verify ${balCheckModal.label}`}
                </p>
              ) : null}
            </div>

            {/* 4 PIN boxes (koi input nahi, isliye mobile keyboard khulta hi nahi) */}
            <div style={{ display: "flex", justifyContent: "center", gap: 14, margin: "28px 0 14px" }}>
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

            {balPinError ? (
              <p style={{ color: "var(--rd, #ef4444)", fontSize: 12.5, margin: "4px 0 10px", fontWeight: 600, textAlign: "center" }}>
                {balPinError}
              </p>
            ) : (
              <div style={{ height: 22 }} />
            )}

            </div>

            <div className="kp" style={{ margin: "8px auto 4px", width: "100%", maxWidth: 320 }}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Check"].map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={k === "Check" && balPinBusy}
                  onClick={() => {
                    if (k === "Check") verify();
                    else if (k === "⌫") {
                      setBalPinError("");
                      setBalCheckModal({ ...balCheckModal, pin: (balCheckModal.pin || "").slice(0, -1) });
                    } else if ((balCheckModal.pin || "").length < 4) {
                      setBalPinError("");
                      setBalCheckModal({ ...balCheckModal, pin: (balCheckModal.pin || "") + k });
                    }
                  }}
                  className={k === "Check" ? "btn" : undefined}
                  style={
                    k === "Check"
                      ? { margin: "0 6px", padding: "14px 0", fontSize: 15, alignSelf: "center", width: "auto", borderRadius: 999 }
                      : { padding: "16px 0", fontSize: 22 }
                  }
                >
                  {k === "Check" ? (balPinBusy ? "…" : balCheckModal.queue && balCheckModal.queue.length > 0 ? "Next →" : "Check") : k}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
