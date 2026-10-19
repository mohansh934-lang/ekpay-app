"use client";

import { Icon } from "@/components/Icon";
import { useEk } from "@/context/EkContext";

export function NotifBanner() {
  const {
    banner,
    setBanner,
    go,
  } = useEk();
  if (!banner) return null;

  return (
    <div
      onClick={() => { setBanner(null); go("notif"); }}
      style={{
        position: "absolute", left: 10, right: 10, top: 34, background: "var(--cd)",
        border: "1px solid var(--ln)", boxShadow: "0 10px 30px rgba(15,23,42,.25)",
        borderRadius: 15, padding: "10px 12px", display: "flex", gap: 10,
        alignItems: "center", zIndex: 45, cursor: "pointer"
      }}
    >
      <span className="it"><Icon n="bell" /></span>
      <span className="m"><b>{banner.title}</b><small>{banner.body}</small></span>
      <small>now</small>
    </div>
  );
}
