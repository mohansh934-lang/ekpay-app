"use client";

import { useEffect, useState } from "react";
import { inr } from "@/lib/format";
import { BrandLogo } from "@/components/BrandLogo";
import { useEk } from "@/context/EkContext";

/**
 * Pay karne wala bank chunne ka shared picker (EK-BANK-PICKER).
 * `openSignal` badhte hi list apne aap khul jaati hai (jaise balance kam hone par).
 * `amount` do to jis bank me itna balance nahi use "Balance kam" dikhta hai.
 */
export function BankPicker({ openSignal = 0, amount = 0 }: { openSignal?: number; amount?: number }) {
  const { banks, payBankIdx, setPayBankIdx, hideBal, tone, showToast } = useEk();
  const [open, setOpen] = useState(false);

  useEffect(() => { if (openSignal > 0) setOpen(true); }, [openSignal]);

  if (!banks.length) return null;
  const idx = Math.min(payBankIdx, banks.length - 1);
  const low = (bal: number) => amount > 0 && amount > bal;

  return (
    <div style={{ textAlign: "left" }}>
      <button
        type="button"
        className="row"
        onClick={() => setOpen((v) => !v)}
        style={{ background: "var(--cd)", border: "1px solid " + (low(banks[idx][1]) ? "#e5484d" : "var(--ln)"), borderRadius: 14, padding: "10px 12px", width: "100%" }}
      >
        <BrandLogo brand={banks[idx][0]} size={34} />
        <span className="m">
          <b>{banks[idx][0]}</b>
          <small style={low(banks[idx][1]) ? { color: "#e5484d" } : undefined}>
            {low(banks[idx][1]) ? "Balance kam hai • " : "Balance "}{hideBal ? "Rs hidden" : inr(banks[idx][1])}
          </small>
        </span>
        <span className="mu" style={{ fontWeight: 600, color: "var(--pr)" }}>{open ? "Close" : "Change"}</span>
      </button>
      {open && (
        <div className="c" style={{ marginTop: 8, border: "1px solid var(--ln)", borderRadius: 14, overflow: "hidden" }}>
          {banks.map((b, i) => (
            <button
              key={b[0] + i}
              type="button"
              className="row"
              onClick={() => {
                setPayBankIdx(i);
                setOpen(false);
                tone(620, 0.04);
                showToast("Paying from " + b[0]);
              }}
              style={{
                background: i === idx ? "rgba(232,26,108,0.08)" : "var(--cd)",
                borderBottom: i < banks.length - 1 ? "1px solid var(--ln)" : "none",
                borderRadius: 0,
                padding: "12px",
              }}
            >
              <BrandLogo brand={b[0]} size={36} />
              <span className="m">
                <b>{b[0]}</b>
                <small style={low(b[1]) ? { color: "#e5484d" } : undefined}>
                  {hideBal ? "Rs hidden" : inr(b[1])}{low(b[1]) ? " • kam" : ""}
                </small>
              </span>
              {i === idx && <b className="cr">Selected</b>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
