"use client";

import { useState } from "react";
import { inr } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { useEk } from "@/context/EkContext";
import { PinPage } from "@/components/modals/PinPage";

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

  const pinNow = balCheckModal.pin || "";
  const onKey = (k: string) => {
    if (k === "Check") verify();
    else if (k === "⌫") {
      setBalPinError("");
      setBalCheckModal({ ...balCheckModal, pin: pinNow.slice(0, -1) });
    } else if (pinNow.length < 4) {
      setBalPinError("");
      setBalCheckModal({ ...balCheckModal, pin: pinNow + k });
    }
  };

  if (result) {
    return (
      <div id="sh" style={{ background: "var(--bg)", justifyContent: "flex-start", zIndex: 30 }}>
        <div className="sb pinpage" style={{ textAlign: "center", position: "relative", background: "var(--bg)" }}>
          <button
            type="button"
            aria-label="Close"
            onClick={closeResult}
            style={{ position: "absolute", top: "calc(12px + var(--sat, 0px))", right: 12, padding: "4px 10px", fontSize: 24, lineHeight: 1, background: "none", color: "inherit", opacity: 0.7, zIndex: 2 }}
          >
            ✕
          </button>
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
        </div>
      </div>
    );
  }

  return (
    <PinPage
      pin={pinNow}
      error={balPinError}
      keys={["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Check"]}
      actionKey="Check"
      actionLabel={balPinBusy ? "…" : balCheckModal.queue && balCheckModal.queue.length > 0 ? "Next →" : "Check"}
      actionDisabled={balPinBusy}
      onKey={onKey}
      onClose={closePin}
    >
      {balCheckModal.totalSteps ? (
        <span className="chip on" style={{ fontSize: 11, marginBottom: 8, display: "inline-block", alignSelf: "center" }}>
          Total Balance • Bank {balCheckModal.step} of {balCheckModal.totalSteps}
        </span>
      ) : null}
      <b style={{ display: "block", fontSize: 17 }}>Enter UPI PIN for {balCheckModal.label}</b>
      {balCheckModal.totalSteps ? (
        <p className="mu" style={{ fontSize: 12 }}>
          {`Line-by-Line PIN (${balCheckModal.step}/${balCheckModal.totalSteps}): Verify ${balCheckModal.label}`}
        </p>
      ) : null}
    </PinPage>
  );
}
