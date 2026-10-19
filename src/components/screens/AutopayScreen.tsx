"use client";

import { inr } from "@/lib/format";
import { BrandLogo } from "@/components/BrandLogo";
import { useEk } from "@/context/EkContext";

export function AutopayScreen() {
  const {
    mandates,
    setMandates,
    showToast,
  } = useEk();

  return (
    <>
      <h3>Active OTT & UPI Autopay Mandates</h3>
      <div className="c">
        {mandates.map((m, i) => (
          <div key={m.id} className="row">
            <BrandLogo brand={m.brand} size={40} />
            <span className="m">
              <b>{m.merchant}</b>
              <small>{inr(m.amt)} • {m.cycle}</small>
            </span>
            <button
              className={`chip ${m.active ? "on" : ""}`}
              onClick={() => {
                const next = mandates.map((x, idx) => (idx === i ? { ...x, active: !x.active } : x));
                setMandates(next);
                showToast(`${m.merchant} ${!m.active ? "Resumed" : "Paused"}`);
              }}
            >
              {m.active ? "Active ✓" : "Paused"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
