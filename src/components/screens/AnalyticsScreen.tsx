"use client";

import { inr } from "@/lib/format";
import { useEk } from "@/context/EkContext";

export function AnalyticsScreen() {
  const {
    budgetTimer,
    budget,
    setBudget,
    txns,
    showToast,
    apiCall,
  } = useEk();

  return (
    <>
      <div className="c p">
        <b>Monthly Spend Limit</b>
        {(() => {
          const spent = txns.filter((t) => !t.cr && t.cat !== "Self Transfer").reduce((a, b) => a + b.amt, 0);
          const pct = Math.min(100, Math.round((spent / budget) * 100));
          return (
            <>
              <h2 style={{ margin: "6px 0" }}>{inr(spent)} <small>/ {inr(budget)}</small></h2>
              <div className="bar"><i style={{ width: `${pct}%` }}></i></div>
              <small>{pct}% of monthly budget used</small>
              <input
                type="range"
                min="10000"
                max="100000"
                step="5000"
                value={budget}
                onChange={(e) => {
                  const v = +e.target.value;
                  setBudget(v);
                  if (budgetTimer.current) clearTimeout(budgetTimer.current);
                  budgetTimer.current = setTimeout(async () => {
                    const r = await apiCall("PATCH", "/api/settings", { budget: v });
                    if (!r.ok) showToast(r.message);
                  }, 500);
                }}
              />
            </>
          );
        })()}
      </div>
    </>
  );
}
