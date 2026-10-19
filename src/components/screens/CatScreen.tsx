"use client";

import { inr } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { CATALOG } from "@/lib/constants";
import { useEk } from "@/context/EkContext";

export function CatScreen() {
  const {
    banks,
    showToast,
    newKey,
    apiCall,
    act,
    payDone,
    subParam,
  } = useEk();

  return (
    <>
      <h3>Verified Offerings</h3>
      <div className="c">
        {CATALOG[subParam].map(([title, desc, badge, price], i) => (
          <div key={i} className="row">
            <span className="it"><Icon n="shield" /></span>
            <span className="m">
              <b>{title}</b>
              <small>{desc}</small>
            </span>
            <button
              className="chip on"
              onClick={() => {
                if (banks[0][1] < price) return showToast("Insufficient bank balance");
                act(async () => {
                  const r = await apiCall("POST", "/api/offerings/buy", {
                    category: subParam, title, idempotencyKey: newKey(),
                  });
                  if (!r.ok) return showToast(r.message);
                  await payDone("Payment Successful", `${inr(r.data.transaction.amount)} debited for ${title}`);
                  showToast(`${title} Activated!`);
                });
              }}
            >
              {badge}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
