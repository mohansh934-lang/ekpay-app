"use client";

import { inr } from "@/lib/format";
import { useEk } from "@/context/EkContext";

export function LoansScreen() {
  const {
    loanId,
    banks,
    emiPaid,
    loanP,
    setLoanP,
    loanN,
    setLoanN,
    loanR,
    showToast,
    newKey,
    apiCall,
    act,
    payDone,
  } = useEk();

  return (
    <>
      <div className="c p">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <b>Active Bike Loan</b>
          <small>{emiPaid} / 36 EMIs Paid</small>
        </div>
        <div className="bar"><i style={{ width: `${(emiPaid / 36) * 100}%` }}></i></div>
        <button
          className="btn"
          onClick={() => {
            if (banks[0][1] < 3240) return showToast("Balance kam hai");
            if (loanId === null) return showToast("Loan details load nahi hui");
            act(async () => {
              const r = await apiCall("POST", "/api/loans/emi", { loanId, idempotencyKey: newKey() });
              if (!r.ok) return showToast(r.message);
              await payDone("Payment Successful", `${inr(r.data.transaction.amount)} debited for Bike Loan EMI`);
              showToast("EMI ₹3,240 Paid!");
            });
          }}
        >
          Pay Next EMI (₹3,240)
        </button>
      </div>
      <div className="c p">
        <b>Instant Cash Loan EMI Calculator</b>
        <div className="mu" style={{ marginTop: 8 }}>Loan: <b style={{ float: "right" }}>{inr(loanP)}</b></div>
        <input type="range" min="50000" max="2000000" step="50000" value={loanP} onChange={(e) => setLoanP(+e.target.value)} />
        <div className="mu">Tenure: <b style={{ float: "right" }}>{loanN} months</b></div>
        <input type="range" min="12" max="120" value={loanN} onChange={(e) => setLoanN(+e.target.value)} />
        {(() => {
          const i = loanR / 1200;
          const e = (loanP * i * Math.pow(1 + i, loanN)) / (Math.pow(1 + i, loanN) - 1);
          return <b style={{ fontSize: 20, display: "block", marginTop: 8 }}>Monthly EMI: {inr(e)}</b>;
        })()}
      </div>
    </>
  );
}
