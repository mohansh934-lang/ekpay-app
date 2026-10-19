"use client";

export function Sparkline({ seed, up, w = 80, h = 30, big = false }: { seed: string; up: boolean; w?: number; h?: number; big?: boolean }) {
  let q = 0;
  for (const c of seed) q += c.charCodeAt(0);
  let y = h / 2;
  const pts: string[] = [];
  for (let i = 0; i < 28; i++) {
    q = (q * 9301 + 49297) % 233280;
    y = Math.max(4, Math.min(h - 4, y + (q / 233280 - (up ? 0.42 : 0.58)) * h * 0.3));
    pts.push((i * w / 27).toFixed(1) + "," + (h - y).toFixed(1));
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={big ? "100%" : w} height={h} preserveAspectRatio="none">
      <path
        d={"M" + pts.join("L")}
        fill="none"
        stroke={up ? "var(--gr)" : "var(--rd)"}
        strokeWidth={big ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
