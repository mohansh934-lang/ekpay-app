"use client";

export function CibilSpeedometer({ score = 785 }: { score?: number }) {
  // Score range: 300 to 900
  const pct = Math.max(0, Math.min(1, (score - 300) / 600));
  const angleDeg = -90 + pct * 180; // -90deg (left) to +90deg (right)

  return (
    <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
      <svg viewBox="0 0 220 130" width="230" height="135" style={{ margin: "0 auto", overflow: "visible" }}>
        <defs>
          <linearGradient id="cibilGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="35%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        {/* Background Track */}
        <path
          d="M 20 110 A 90 90 0 0 1 200 110"
          fill="none"
          stroke="var(--ln)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {/* Colored Speedometer Arc */}
        <path
          d="M 20 110 A 90 90 0 0 1 200 110"
          fill="none"
          stroke="url(#cibilGrad)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray="283"
          strokeDashoffset={283 - 283 * pct}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
        {/* Scale Labels */}
        <text x="12" y="128" fontSize="10" fill="var(--mu)" fontWeight="600">300</text>
        <text x="102" y="12" fontSize="10" fill="var(--mu)" fontWeight="600">600</text>
        <text x="192" y="128" fontSize="10" fill="var(--mu)" fontWeight="600">900</text>

        {/* Rotating Speedometer Needle */}
        <g transform={`translate(110, 110) rotate(${angleDeg})`} style={{ transition: "transform 1s cubic-bezier(.2,1.2,.3,1)" }}>
          <polygon points="-4,0 0,-76 4,0" fill="var(--tx)" />
          <circle cx="0" cy="0" r="8" fill="var(--pr)" />
          <circle cx="0" cy="0" r="3.5" fill="#fff" />
        </g>
      </svg>
      <h1 style={{ fontSize: 40, fontWeight: 800, color: "var(--gr)", margin: "-4px 0 2px", letterSpacing: -1 }}>
        {score}
      </h1>
      <span className="chip on" style={{ background: "var(--gr)", borderColor: "var(--gr)", fontSize: 11.5 }}>
        EXCELLENT SCORE (Top 12% in India)
      </span>
    </div>
  );
}
