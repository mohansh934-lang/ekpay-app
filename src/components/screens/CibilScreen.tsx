"use client";

import { CibilSpeedometer } from "@/components/CibilSpeedometer";
import { useEk } from "@/context/EkContext";

export function CibilScreen() {
  const {
    showToast,
  } = useEk();

  return (
    <div className="c p" style={{ textAlign: "center" }}>
      <small>Powered by Experian & TransUnion CIBIL</small>
      <CibilSpeedometer score={785} />
      <div className="c" style={{ marginTop: 14, textAlign: "left" }}>
        <div className="row"><span className="m">On-time EMI & Card Payments</span><b className="cr">100% (48/48)</b></div>
        <div className="row"><span className="m">Credit Limit Utilization</span><b className="cr">6% (Ideal &lt; 30%)</b></div>
        <div className="row"><span className="m">Credit Age</span><b>4 Years 8 Months</b></div>
        <div className="row"><span className="m">Hard Enquiries</span><b>0 in last 6 months</b></div>
      </div>
      <button className="btn o" onClick={() => showToast("CIBIL Score is already up-to-date!")}>
        Refresh CIBIL Report
      </button>
    </div>
  );
}
