"use client";
// EK-REAL-LOGOS: real-logos.mjs ne banaya. Manifest (src/lib/brandLogos.json) se local /logos/* images dikhata hai.
import React, { useState } from "react";
import manifest from "@/lib/brandLogos.json";

const LOGOS = manifest as Record<string, string>;

const normalize = (raw: string): string =>
  (raw || "")
    .toLowerCase()
    .replace(/••\d+/g, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();

const EXACT_ONLY = new Set(["vi", "bob", "ola"]);

const ENTRIES = Object.keys(LOGOS)
  .map((k) => ({ key: normalize(k), src: LOGOS[k] }))
  .filter((e) => e.key)
  .sort((a, b) => b.key.length - a.key.length);

function findLogo(raw: string): string | null {
  const clean = normalize(raw);
  if (!clean) return null;
  const padded = " " + clean + " ";
  for (const e of ENTRIES) {
    if (e.key.length <= 2 || EXACT_ONLY.has(e.key)) {
      if (clean === e.key) return e.src;
      continue;
    }
    if (padded.includes(" " + e.key + " ")) return e.src;
  }
  return null;
}

function getInitials(raw: string): string {
  const cleaned = (raw || "")
    .replace(/••\d+/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

const PALETTE = [
  "linear-gradient(135deg, #e81a6c, #9d0b48)",
  "linear-gradient(135deg, #2563eb, #1e40af)",
  "linear-gradient(135deg, #059669, #065f46)",
  "linear-gradient(135deg, #7c3aed, #4c1d95)",
  "linear-gradient(135deg, #d97706, #92400e)",
  "linear-gradient(135deg, #0891b2, #155e75)",
];

export function BrandLogo({
  brand,
  name: nameProp,
  size = 38,
  className = "",
}: {
  brand?: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const name = brand ?? nameProp ?? "";
  const src = findLogo(name);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const radius = Math.round(size * 0.28);

  if (src && failedSrc !== src) {
    const pad = Math.max(2, Math.round(size * 0.12));
    return (
      <span
        className={className}
        title={name}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: "#ffffff",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
          boxSizing: "border-box",
          padding: pad,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
          onError={() => setFailedSrc(src)}
        />
      </span>
    );
  }

  // Smart fallbacks: IRCTC / train, Gold, Self Deposit (no more "I1" / "2D")
  const low = (name || "").toLowerCase();
  const iconWrap = (bg: string, svg: React.ReactNode) => (
    <span
      className={className}
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: bg,
        color: "#ffffff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
      }}
    >
      {svg}
    </span>
  );
  const iconSize = Math.round(size * 0.55);

  // IRCTC / train → train logo
  if (low.includes("irctc") || /\btrain\b/.test(low) || /#\d{3,}/.test(name)) {
    return iconWrap(
      "linear-gradient(135deg, #003366, #001a33)",
      <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="3" width="14" height="14" rx="3" />
        <path d="M5 11h14M8 21l2-4M16 21l-2-4" />
        <circle cx="9" cy="14" r="1.2" fill="#fff" stroke="none" />
        <circle cx="15" cy="14" r="1.2" fill="#fff" stroke="none" />
      </svg>
    );
  }

  // 24K Digital Gold → gold coin
  if (low.includes("gold") || low.includes("24k")) {
    return iconWrap(
      "linear-gradient(135deg, #f59e0b, #b45309)",
      <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="none">
        <circle cx="12" cy="12" r="9" fill="#fbbf24" stroke="#92400e" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="6.5" fill="none" stroke="#b45309" strokeWidth="1.2" />
        <text x="12" y="15.5" textAnchor="middle" fill="#78350f" fontSize="9" fontWeight="800" fontFamily="Inter,sans-serif">₹</text>
      </svg>
    );
  }

  // Self Deposit / Top-up → neeche tircha teer
  if (low.includes("self deposit") || low.includes("top-up") || low.includes("topup") || low.includes("add money")) {
    return iconWrap(
      "linear-gradient(135deg, #059669, #065f46)",
      <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M6 13l6 6 6-6" />
      </svg>
    );
  }

  // Self Transfer
  if (low.includes("self transfer") || /^to\s/.test(low) || /^from\s/.test(low)) {
    return iconWrap(
      "linear-gradient(135deg, #2563eb, #1e40af)",
      <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 7h10M17 7l-3-3M17 7l-3 3M17 17H7M7 17l3-3M7 17l3 3" />
      </svg>
    );
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return (
    <span
      className={className}
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: PALETTE[hash % PALETTE.length],
        color: "#ffffff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontWeight: 800,
        fontSize: Math.round(size * 0.36),
        letterSpacing: 0.5,
        userSelect: "none",
      }}
    >
      {getInitials(name)}
    </span>
  );
}

export default BrandLogo;
