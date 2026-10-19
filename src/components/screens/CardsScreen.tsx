"use client";

import { inr } from "@/lib/format";
import { useEk } from "@/context/EkContext";

export function CardsScreen() {
  const {
    banks,
    cardDue,
    showToast,
    newKey,
    apiCall,
    act,
    payDone,
    myName,
  } = useEk();

  return (
    <>
      <div className="card3d">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <b>HDFC Regalia Gold</b>
          <b>VISA</b>
        </div>
        <div className="chp"></div>
        <div>
          <div style={{ fontSize: 16, letterSpacing: 3 }}>•••• •••• •••• 4821</div>
          <small style={{ color: "rgba(255,255,255,.7)" }}>{myName.toUpperCase()} • Limit ₹3,00,000</small>
        </div>
      </div>
      <div className="c p">
        <small>Statement Bill Due</small>
        <h2>{inr(cardDue)}</h2>
        <button
          className="btn"
          onClick={() => {
            if (cardDue <= 0) return showToast("Bill already paid!");
            if (banks[0][1] < cardDue) return showToast("Balance kam hai");
            act(async () => {
              const r = await apiCall("POST", "/api/card/pay", { idempotencyKey: newKey() });
              if (!r.ok) return showToast(r.message);
              await payDone("Payment Successful", `${inr(r.data.transaction.amount)} debited for HDFC Credit Card Bill`);
              showToast("Credit Card Bill Cleared!");
            });
          }}
        >
          {cardDue > 0 ? `Pay Credit Card Bill (${inr(cardDue)})` : "All Dues Cleared ✓"}
        </button>
      </div>
    </>
  );
}
