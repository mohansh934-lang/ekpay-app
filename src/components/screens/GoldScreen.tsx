"use client";

import { inr } from "@/lib/format";
import { useEk } from "@/context/EkContext";

export function GoldScreen() {
  const {
    banks,
    goldGrams,
    showToast,
    newKey,
    apiCall,
    act,
    payDone,
  } = useEk();

  return (
    <div className="c p">
      <b>24K 99.9% Digital Gold Vault</b>
      <h2 style={{ margin: "6px 0" }}>{goldGrams.toFixed(3)} grams ({inr(goldGrams * 7820)})</h2>
      <small>Live Market Rate: ₹7,820 / gram</small>
      <button
        className="btn"
        onClick={() => {
          if (banks[0][1] < 1000) return showToast("Balance kam hai");
          act(async () => {
            const r = await apiCall("POST", "/api/gold/buy", { amount: 1000, idempotencyKey: newKey() });
            if (!r.ok) return showToast(r.message);
            await payDone("Payment Successful", `${inr(1000)} debited for 24K Digital Gold`);
            showToast("₹1,000 Digital Gold added to vault!");
          });
        }}
      >
        Buy ₹1,000 Instant Gold
      </button>
    </div>
  );
}
