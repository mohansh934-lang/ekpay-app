"use client";

import { Icon } from "@/components/Icon";
import { useEk } from "@/context/EkContext";
import { HomeSearch } from "@/components/layout/HomeSearch";

export function AppHeader() {
  const {
    view,
    unread,
    go,
    back,
    initials,
    isRootTab,
    headerTitle,
  } = useEk();

  return (
    <div id="hd">
      {isRootTab ? (
        <>
          <span
            className="av"
            title="Open My Profile & QR"
            style={{ background: "#fce7f0", color: "#9d1048", cursor: "pointer", border: "2px solid var(--pr)" }}
            onClick={() => go("profile")}
          >
            {initials}
          </span>
          {view === "home" ? (
            <HomeSearch />
          ) : (
            <span className="g">{headerTitle}</span>
          )}
          <button className="ib" onClick={() => go("notif")}>
            <Icon n="bell" s={19} />
            {unread > 0 && <b>{unread}</b>}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="ib"
            onClick={back}
            style={{ background: "var(--cd)", border: "1px solid var(--ln)" }}
          >
            <Icon n="back" s={20} />
          </button>
          <span className="g">{headerTitle}</span>
          <button className="ib" onClick={() => go("notif")}>
            <Icon n="bell" s={19} />
            {unread > 0 && <b>{unread}</b>}
          </button>
        </>
      )}
    </div>
  );
}
