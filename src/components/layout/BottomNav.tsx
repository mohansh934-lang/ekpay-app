"use client";

import { Icon } from "@/components/Icon";
import { useEk } from "@/context/EkContext";

export function BottomNav() {
  const {
    go,
    tab,
    baseView,
  } = useEk();

  return (
    <nav>
      <button className={baseView === "home" ? "on" : ""} onClick={() => tab("home")}><Icon n="home" />Home</button>
      <button className={baseView === "txns" ? "on" : ""} onClick={() => tab("txns")}><Icon n="rec" />Passbook</button>
      <button className="pay" onClick={() => go("scan")}><span><Icon n="scan" /></span>Scan</button>
      <button className={baseView === "invest" ? "on" : ""} onClick={() => tab("invest")}><Icon n="trend" />Wealth</button>
      <button className={baseView === "more" ? "on" : ""} onClick={() => tab("more")}><Icon n="gear" />Settings</button>
    </nav>
  );
}
