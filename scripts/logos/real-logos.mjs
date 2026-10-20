#!/usr/bin/env node
/**
 * real-logos.mjs: BrandLogo ko real (download kiye hue) logos se chalata hai.
 *
 * Project root me chalao (jahan package.json aur brand-logos.json hain):
 *     node real-logos.mjs
 *
 * Ye 3 kaam karta hai:
 *   1. src/components/BrandLogo.tsx likhta hai (brand= aur name= dono leta hai,
 *      poore-shabd ka matching: "Vikram" ko Vi ka logo NAHI milta, logo na ho to initials).
 *   2. brand-logos.json ke domains ke logos public/logos/ me download karta hai
 *      (Google favicon 128px, na mile to DuckDuckGo; default globe icon pehchan ke skip).
 *   3. src/lib/brandLogos.json banata hai (naam -> /logos/file.png), jise component padhta hai.
 *
 * Official logo lagana ho to file public/logos/manual/ me rakho aur script dobara chalao:
 *     public/logos/manual/sbi.png                 (brand ke naam se)  ya
 *     public/logos/manual/sbi-co-in.png           (domain se, us domain ke saare naam badal jaate hain)
 *
 * Flags: --force (sab dobara download + BrandLogo.tsx overwrite), --no-download (sirf component + manifest)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const FORCE = process.argv.includes("--force");
const NO_DL = process.argv.includes("--no-download");

const CATALOG = path.join(ROOT, "scripts/logos/brand-logos.json");
const COMPONENT = path.join(ROOT, "src/components/BrandLogo.tsx");
const MANIFEST = path.join(ROOT, "src/lib/brandLogos.json");
const OUT_DIR = path.join(ROOT, "public/logos");
const MANUAL_DIR = path.join(OUT_DIR, "manual");
const MARKER = "EK-REAL-LOGOS";

const SOURCES = [
  process.env.LOGO_URL_1 || "https://www.google.com/s2/favicons?domain={domain}&sz=128",
  process.env.LOGO_URL_2 || "https://icons.duckduckgo.com/ip3/{domain}.ico",
];

const die = (m) => { console.error("\n❌ " + m + "\n"); process.exit(1); };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

if (!fs.existsSync(path.join(ROOT, "package.json"))) die("package.json nahi mila. Project root me script chalao.");
if (!fs.existsSync(CATALOG)) die("brand-logos.json nahi mila. Usse scripts/logos/ me rakho.");
let catalog;
try { catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8")); } catch { die("brand-logos.json valid JSON nahi hai."); }
const keys = Object.keys(catalog).filter((k) => catalog[k] && typeof catalog[k].domain === "string");
if (!keys.length) die("brand-logos.json me koi {domain} entry nahi mili.");

// ---------------------------------------------------------------------------
// 1. Component
// ---------------------------------------------------------------------------
const COMPONENT_SRC = String.raw`"use client";
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
`;

fs.mkdirSync(path.dirname(COMPONENT), { recursive: true });
const existing = fs.existsSync(COMPONENT) ? fs.readFileSync(COMPONENT, "utf8") : "";
if (existing.includes(MARKER) && !FORCE) {
  console.log("⏭  BrandLogo.tsx pehle se real-logos wala hai (naya likhne ke liye --force)");
} else {
  fs.writeFileSync(COMPONENT, COMPONENT_SRC, "utf8");
  console.log("✅ 1. src/components/BrandLogo.tsx likha (brand= / name= dono, poore-shabd matching, initials fallback)");
}

// manifest pehle se bana do, taaki download beech me fail bhi ho to build na tute
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
if (!fs.existsSync(MANIFEST)) fs.writeFileSync(MANIFEST, "{}\n", "utf8");

// ---------------------------------------------------------------------------
// 2. Download
// ---------------------------------------------------------------------------
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(MANUAL_DIR, { recursive: true });

function sniff(buf) {
  if (buf.length < 4) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) return "ico";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (buf.subarray(0, 3).toString() === "GIF") return "gif";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  const head = buf.subarray(0, 200).toString("utf8").trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "svg";
  return null;
}
async function get(url) {
  const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(12000), headers: { "user-agent": "Mozilla/5.0 (ek-app logo fetch)" } });
  if (!r.ok) return null;
  return Buffer.from(await r.arrayBuffer());
}
const urlFor = (tpl, domain) => tpl.replace("{domain}", encodeURIComponent(domain));
const existingFor = (dslug) => fs.readdirSync(OUT_DIR).find((f) => f.startsWith(dslug + ".") && f !== "manual");

const failed = [], lowres = [], cached = [];
let downloaded = 0;

async function main() {
  if (!NO_DL) {
    // "default / globe" icon ki fingerprint: ek aisa domain jo exist hi nahi karta
    const defaults = new Set();
    for (const tpl of SOURCES) {
      try { const b = await get(urlFor(tpl, "zzz-no-such-brand-98765.invalid")); if (b) defaults.add(sha(b)); } catch { /* ignore */ }
    }

    const domains = [...new Set(keys.map((k) => catalog[k].domain.toLowerCase()))];
    console.log(`==> ${domains.length} domains ke logos download ho rahe hain...`);
    let idx = 0;
    const worker = async () => {
      while (idx < domains.length) {
        const domain = domains[idx++];
        const ds = slug(domain);
        if (!FORCE && existingFor(ds)) { cached.push(domain); continue; }
        let best = null;
        for (const tpl of SOURCES) {
          let buf = null;
          try { buf = await get(urlFor(tpl, domain)); } catch { buf = null; }
          if (!buf) continue;
          const ext = sniff(buf);
          if (!ext || buf.length < 200 || defaults.has(sha(buf))) continue;
          const low = ext === "png" && buf.length >= 24 && buf.readUInt32BE(16) < 48;
          if (!best || (best.low && !low)) best = { buf, ext, low };
          if (!low) break;
        }
        if (!best) { failed.push(domain); continue; }
        for (const f of fs.readdirSync(OUT_DIR)) if (f.startsWith(ds + ".")) fs.rmSync(path.join(OUT_DIR, f), { force: true });
        fs.writeFileSync(path.join(OUT_DIR, ds + "." + best.ext), best.buf);
        downloaded++;
        if (best.low) lowres.push(domain);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    console.log(`✅ 2. Download: ${downloaded} naye, ${cached.length} pehle se the, ${failed.length} nahi mile`);
  } else {
    console.log("⏭  Download skip (--no-download)");
  }

  // -------------------------------------------------------------------------
  // 3. Manifest (manual override > download)
  // -------------------------------------------------------------------------
  const manual = new Map(); // slug -> filename
  for (const f of fs.readdirSync(MANUAL_DIR)) {
    const ext = path.extname(f).slice(1).toLowerCase();
    if (["png", "svg", "jpg", "jpeg", "webp", "gif", "ico"].includes(ext)) manual.set(slug(path.basename(f, "." + ext)), f);
  }
  const out = {};
  let usedManual = 0;
  for (const k of [...keys].sort()) {
    const domain = catalog[k].domain.toLowerCase();
    const m = manual.get(slug(k)) || manual.get(slug(domain));
    if (m) { out[k] = "/logos/manual/" + m; usedManual++; continue; }
    const f = existingFor(slug(domain));
    if (f) out[k] = "/logos/" + f;
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`✅ 3. src/lib/brandLogos.json: ${Object.keys(out).length}/${keys.length} naam ke logo mile` + (usedManual ? ` (${usedManual} manual)` : ""));

  const missingNames = keys.filter((k) => !out[k]);
  if (missingNames.length) console.log("\n⚠ In naamon ka logo nahi mila (initials dikhenge): " + missingNames.join(", "));
  if (lowres.length) console.log("\n⚠ Ye logo chhote (dhundhle ho sakte hain): " + lowres.join(", "));
  console.log("\nAb: npx tsc --noEmit  &&  npm run dev   (browser me hard refresh: Ctrl+Shift+R)");
  console.log("Kisi brand ka official logo lagana ho: file public/logos/manual/<naam>.png me rakho (jaise sbi.png), phir `node real-logos.mjs` dobara chalao.");
}
main().catch((e) => die(String(e && e.stack || e)));
