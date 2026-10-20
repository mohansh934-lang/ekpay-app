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

// Itne chhote / aam naam sirf POORE naam se match hote hain ("Vi" haan, "Vikram Singh" nahi, "Bob Marley" nahi)
const EXACT_ONLY = new Set(["vi", "bob", "ola"]);

const ENTRIES = Object.keys(LOGOS)
  .map((k) => ({ key: normalize(k), src: LOGOS[k] }))
  .filter((e) => e.key)
  .sort((a, b) => b.key.length - a.key.length); // lamba naam pehle: "hdfc bank" > "hdfc"

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
