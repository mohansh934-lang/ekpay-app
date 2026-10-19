"use client";

import { Icon } from "@/components/Icon";
import { useEk } from "@/context/EkContext";

export function NotifScreen() {
  const {
    notifs,
  } = useEk();

  return (
    <>
      <h3>All Alerts ({notifs.length})</h3>
      <div className="c">
        {notifs.map((n, i) => (
          <div key={i} className="row">
            <span className="it"><Icon n="bell" /></span>
            <span className="m">
              <b>{n.title}</b>
              <small style={{ whiteSpace: "normal" }}>{n.body}</small>
            </span>
            <small>{n.time}</small>
          </div>
        ))}
      </div>
    </>
  );
}
