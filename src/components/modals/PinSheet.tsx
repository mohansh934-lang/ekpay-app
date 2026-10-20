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
    setPinSheet,
    pin,
    setPin,
    handlePinKey,
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
      {/* EK-NO-BANK-CYCLE: bank yahan nahi badalta, amount screen pe badlo */}
      <small className="mu">{banks[safeIdx]?.[0]} • EkPay Secure UPI</small>
      <b style={{ display: "block", fontSize: 17, marginTop: 18 }}>Enter UPI PIN</b>
    </PinPage>
  );
}
