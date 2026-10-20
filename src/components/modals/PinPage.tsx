"use client";

import type { ReactNode } from "react";

/** Full-screen UPI PIN page (balance check aur payment dono yahi use karte hain) - EK-PINPAGE */
export function PinPage({
  children, pin, error, message, keys, actionKey, actionLabel, actionDisabled, onKey, onClose,
}: {
  children: ReactNode;
  pin: string;
  error?: string;
  message?: string;
  keys: string[];
  actionKey?: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  onKey: (k: string) => void;
  onClose: () => void;
}) {
  return (
    <div id="sh" style={{ background: "var(--bg)", justifyContent: "flex-start", zIndex: 30 }}>
      <div
        className="sb pinpage"
        style={{ textAlign: "center", position: "relative", display: "flex", flexDirection: "column", background: "var(--bg)" }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{ position: "absolute", top: "calc(12px + var(--sat, 0px))", right: 12, padding: "4px 10px", fontSize: 24, lineHeight: 1, background: "none", color: "inherit", opacity: 0.7, zIndex: 2 }}
        >
          ✕
        </button>
        <span style={{ position: "absolute", top: "calc(18px + var(--sat, 0px))", left: 16, fontSize: 13, fontWeight: 600, opacity: 0.75 }}>
          Payments secured by UPI
        </span>

        {/* Upar ka content PIN boxes ke saath keypad ke bilkul upar baitha hai (beech me hawa me nahi) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingTop: 52 }}>
          {children}

          <div style={{ display: "flex", justifyContent: "center", gap: 14, margin: "22px 0 8px" }}>
            {[0, 1, 2, 3].map((i) => {
              const filled = pin.length > i;
              const active = pin.length === i;
              return (
                <div
                  key={i}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    border: active ? "2px solid var(--pr)" : "2px solid var(--ln)",
                    background: filled ? "var(--pr)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    fontWeight: 700,
                    color: "#fff",
                    boxShadow: active ? "0 0 0 4px rgba(232,26,108,.22)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {filled ? "•" : ""}
                </div>
              );
            })}
          </div>

          <div style={{ minHeight: 20, marginBottom: 4 }}>
            {error ? (
              <p style={{ color: "var(--rd, #ef4444)", fontSize: 12.5, fontWeight: 600 }}>{error}</p>
            ) : message ? (
              <small className="mu">{message}</small>
            ) : null}
          </div>
        </div>

        <div className="kp">
          {keys.map((k, i) =>
            k === "" ? (
              <span key={"gap" + i} />
            ) : k === actionKey ? (
              <button key={k} type="button" className="btn" disabled={actionDisabled} onClick={() => onKey(k)}>
                {actionLabel ?? k}
              </button>
            ) : (
              <button key={k} type="button" onClick={() => onKey(k)}>{k}</button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
