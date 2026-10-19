"use client";

import { inr } from "@/lib/format";
import { useEk } from "@/context/EkContext";

export function UpiliteScreen() {
  const {
    upiLiteBal,
    setCurPin,
    setPinTask,
    banks,
    setNumModal,
    showToast,
    newKey,
    apiCall,
    payDone,
  } = useEk();

  return (
    <div className="c p">
      <b>⚡ EkPay UPI Lite</b>
      <p className="mu" style={{ marginTop: 4 }}>
        Make superfast payments up to ₹500 without entering your 4-digit UPI PIN.
      </p>
      <h1 style={{ fontSize: 34, margin: "12px 0" }}>{inr(upiLiteBal)}</h1>
      <small>Max Wallet Limit: ₹2,000</small>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {[200, 500, 1000].map((amt) => (
          <button
            key={amt}
            className="chip on"
            onClick={() => {
              if (banks[0][1] < amt) return showToast("Bank balance kam hai");
              setPinTask({
                label: "Add to UPI Lite",
                amount: amt,
                run: async (pin) => {
                  const r = await apiCall("POST", "/api/upi-lite/topup", { amount: amt, pin, idempotencyKey: newKey() });
                  if (r.ok) {
                    await payDone("UPI Lite Topped Up", `${inr(amt)} added to UPI Lite`);
                    showToast(`Added ${inr(amt)} to UPI Lite!`);
                  }
                  return r;
                },
              });
              setCurPin("");
              setNumModal("confirmpin");
            }}
          >
            + Add ₹{amt}
          </button>
        ))}
      </div>
    </div>
  );
}
