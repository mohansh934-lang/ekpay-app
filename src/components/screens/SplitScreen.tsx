"use client";

import { inr } from "@/lib/format";
import { useEk } from "@/context/EkContext";

export function SplitScreen() {
  const {
    splitAmt,
    setSplitAmt,
    pushNotif,
    tab,
  } = useEk();

  return (
    <div className="c p">
      <b>Split Group Bill on EkPay</b>
      <small style={{ display: "block", marginTop: 8 }}>Total Bill Amount</small>
      <input type="number" value={splitAmt} onChange={(e) => setSplitAmt(+e.target.value)} />
      <p className="mu" style={{ marginTop: 10 }}>
        Splitting equally with Rahul Sharma, Priya Verma & You (3 ways):
      </p>
      <h2 style={{ margin: "8px 0" }}>{inr(splitAmt / 3)} / person</h2>
      <button
        className="btn"
        onClick={() => {
          pushNotif("Split Collect Sent", `Requested ${inr(splitAmt / 3)} each from Rahul & Priya`);
          tab("home");
        }}
      >
        Send EkPay Collect Request
      </button>
    </div>
  );
}
