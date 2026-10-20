"use client";

import { useEk } from "@/context/EkContext";
import { PinPage } from "@/components/modals/PinPage";

export function PinSheet() {
  const {
    payBusy,
    pinErr,
    setPinErr,
    payKey,
    contacts,
    banks,
    payToIdx,
    payAmt,
    payBankIdx,
    setPayBankIdx,
    setPinSheet,
    pin,
    setPin,
    handlePinKey,
    showToast,
  } = useEk();

  const amountText = "₹" + Number(payAmt || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const safeIdx = banks.length ? Math.min(payBankIdx, banks.length - 1) : 0;

  return (
    <PinPage
      pin={pin}
      error={pinErr}
      message={payBusy ? "Verifying…" : ""}
      keys={["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Pay"]}
      actionKey="Pay"
      actionLabel={payBusy ? "…" : "Pay"}
      actionDisabled={payBusy}
      onKey={handlePinKey}
      onClose={() => { setPinSheet(false); setPinErr(""); setPin(""); payKey.current = ""; }}
    >
      <small className="mu">Paying {contacts[payToIdx]?.[0]}</small>
      <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: -1, margin: "4px 0" }}>{amountText}</h1>
      {banks.length > 1 ? (
        <button
          type="button"
          onClick={() => {
            const next = (safeIdx + 1) % banks.length;
            setPayBankIdx(next);
            setPin("");
            setPinErr("");
            showToast("Bank: " + banks[next][0]);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            margin: "4px auto 0",
            padding: "6px 12px",
            borderRadius: 20,
            border: "1px solid var(--ln)",
            background: "var(--cd)",
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          {banks[safeIdx]?.[0]} · Change bank
        </button>
      ) : (
        <small className="mu">{banks[safeIdx]?.[0]} • EkPay Secure UPI</small>
      )}
      <b style={{ display: "block", fontSize: 17, marginTop: 18 }}>Enter UPI PIN</b>
    </PinPage>
  );
}
