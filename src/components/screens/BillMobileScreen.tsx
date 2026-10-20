"use client";

import { inr } from "@/lib/format";
import { BrandLogo } from "@/components/BrandLogo";
import { TELECOM_PLANS } from "@/lib/constants";
import { useEk } from "@/context/EkContext";

export function BillMobileScreen() {
  const {
    mobNum,
    setMobNum,
    mobOp,
    setMobOp,
    mobTab,
    setMobTab,
    showToast,
    triggerCheckout,
  } = useEk();

  return (
    <>
      <div className="c p">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <BrandLogo brand={mobOp} size={44} />
          <div style={{ flex: 1 }}>
            <b>{mobOp} Prepaid Recharge</b>
            <input
              placeholder="10-digit Mobile Number"
              maxLength={10}
              value={mobNum}
              onChange={(e) => setMobNum(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
        <small style={{ display: "block", marginTop: 10 }}>Switch Operator</small>
        <div className="chips">
          {(["Jio", "Airtel", "Vi", "BSNL"] as const).map((op) => (
            <button key={op} className={`chip ${mobOp === op ? "on" : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setMobOp(op)}>
              <BrandLogo brand={op} size={20} radius={6} />{op}
            </button>
          ))}
        </div>
      </div>

      <div className="chips">
        {["All", "Popular", "5G Unlimited", "Annual", "Data Add-on"].map((c) => (
          <button key={c} className={`chip ${mobTab === c ? "on" : ""}`} onClick={() => setMobTab(c)}>
            {c}
          </button>
        ))}
      </div>

      <h3>{mobOp} Official Plans</h3>
      <div className="c">
        {TELECOM_PLANS[mobOp]
          .filter((p) => mobTab === "All" || p.cat === mobTab)
          .map((p, i) => (
            <div key={i} className="row" style={{ alignItems: "center" }}>
              <BrandLogo brand={mobOp} size={36} />
              <div style={{ minWidth: 62 }}>
                <b style={{ fontSize: 16, color: "var(--pr)" }}>{inr(p.price)}</b>
                <br />
                <small>{p.val}</small>
              </div>
              <span className="m">
                <b>{p.data}</b>
                <small style={{ whiteSpace: "normal", display: "block" }}>{p.desc}</small>
              </span>
              <button
                className="chip on"
                onClick={() => {
                  if (mobNum.length !== 10) return showToast("10-digit mobile number daalo");
                  triggerCheckout(`${mobOp} (${mobNum})`, p.price, `${p.data} • ${p.val} • ${p.desc}`);
                }}
              >
                Pay
              </button>
            </div>
          ))}
      </div>
    </>
  );
}
