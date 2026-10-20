"use client";

export function BrandLogo({ brand, size = 42 }: { brand: string; size?: number }) {
  const b = brand.toLowerCase();

  // 1. JioHotstar (Blue-Purple-Pink Gradient + White Star)
  if (b.includes("hotstar")) {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ flex: "none", borderRadius: 11, boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>
        <defs>
          <linearGradient id="jhG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00a8ff" />
            <stop offset="50%" stopColor="#6c2bd9" />
            <stop offset="100%" stopColor="#ff006e" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="22" fill="url(#jhG)" />
        <polygon points="50,15 54,34 86,12 60,40 76,48 56,48 50,70 46,48 24,46 42,38 28,22 46,34" fill="#fff" />
        <text x="50" y="88" textAnchor="middle" fill="#fff" fontSize="14.5" fontWeight="700" fontFamily="Inter,sans-serif">JioHotstar</text>
      </svg>
    );
  }

  // 2. Netflix (Dark Square + Red 'N' Ribbon)
  if (b.includes("netflix")) {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ flex: "none", borderRadius: 11, boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>
        <rect width="100" height="100" rx="22" fill="#181818" />
        <rect x="28" y="18" width="14" height="64" fill="#b1060f" />
        <rect x="58" y="18" width="14" height="64" fill="#b1060f" />
        <polygon points="28,18 42,18 72,82 58,82" fill="#e50914" />
      </svg>
    );
  }

  // 3. Prime Video (Sky-to-Deep Blue + White Smile Arrow)
  if (b.includes("prime")) {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ flex: "none", borderRadius: 11, boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>
        <defs>
          <linearGradient id="pvG" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#26b5ff" />
            <stop offset="100%" stopColor="#002e5d" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="22" fill="url(#pvG)" />
        <text x="50" y="42" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="800" fontFamily="Inter,sans-serif">prime</text>
        <text x="50" y="64" textAnchor="middle" fill="#fff" fontSize="21" fontWeight="700" fontFamily="Inter,sans-serif">video</text>
        <path d="M 24 72 Q 50 88 76 72" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M 69 70 L 78 71 L 74 79" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // 4. ZEE5 (Dark Box + Colorful Arcs + Cream Circle + ZEE5)
  if (b.includes("zee5")) {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ flex: "none", borderRadius: 11, boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>
        <rect width="100" height="100" rx="22" fill="#07121e" />
        <path d="M 52 14 A 36 36 0 1 0 52 86" fill="none" stroke="#2ec4b6" strokeWidth="4" />
        <path d="M 64 22 A 30 30 0 1 0 62 80" fill="none" stroke="#ffbe0b" strokeWidth="4" />
        <path d="M 56 26 A 24 24 0 1 0 68 72" fill="none" stroke="#ff006e" strokeWidth="4" />
        <circle cx="52" cy="50" r="24" fill="#f5ebe0" />
        <text x="64" y="56" textAnchor="middle" fill="#07121e" fontSize="19" fontWeight="800" fontFamily="Inter,sans-serif">ZEE5</text>
      </svg>
    );
  }

  // 5. Crunchyroll (Glossy Orange + White Eye Swirl)
  if (b.includes("crunchyroll")) {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ flex: "none", borderRadius: 11, boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>
        <defs>
          <linearGradient id="crG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff9e44" />
            <stop offset="50%" stopColor="#f47521" />
            <stop offset="100%" stopColor="#d95b00" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="22" fill="url(#crG)" />
        <circle cx="50" cy="44" r="24" fill="#fff" />
        <circle cx="53" cy="46" r="18" fill="#f47521" />
        <circle cx="48" cy="47" r="14" fill="#fff" />
        <circle cx="57" cy="40" r="6.5" fill="#f47521" />
        <text x="50" y="84" textAnchor="middle" fill="#fff" fontSize="13.5" fontWeight="700" fontFamily="Inter,sans-serif">crunchyroll</text>
      </svg>
    );
  }

  // 6. SonyLIV (Dark & Purple Wave + White SONY + Gold liv)
  if (b.includes("sonyliv") || b.includes("sony")) {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ flex: "none", borderRadius: 11, boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>
        <defs>
          <linearGradient id="slG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#090c15" />
            <stop offset="55%" stopColor="#7209b7" />
            <stop offset="100%" stopColor="#f72585" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="22" fill="url(#slG)" />
        <text x="50" y="34" textAnchor="middle" fill="#fff" fontSize="21" fontWeight="800" letterSpacing="1" fontFamily="Georgia,serif">SONY</text>
        <text x="50" y="82" textAnchor="middle" fill="#ffb703" fontSize="34" fontWeight="900" fontFamily="Inter,sans-serif">liv</text>
      </svg>
    );
  }

  // EK-SPOTIFY-YT: Spotify + YouTube logos
  if (b.includes("spotify")) {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ flex: "none", borderRadius: 11, boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>
        <rect width="100" height="100" rx="22" fill="#121212" />
        <circle cx="50" cy="50" r="34" fill="#1ed760" />
        <path d="M27 38Q51 30 75 42" fill="none" stroke="#121212" strokeWidth="6.5" strokeLinecap="round" />
        <path d="M30 52Q51 45 71 55" fill="none" stroke="#121212" strokeWidth="5.2" strokeLinecap="round" />
        <path d="M34 65Q51 60 66 67" fill="none" stroke="#121212" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (b.includes("youtube")) {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ flex: "none", borderRadius: 11, boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>
        <rect width="100" height="100" rx="22" fill="#fff" />
        <rect x="12" y="27" width="76" height="46" rx="14" fill="#ff0000" />
        <polygon points="43,38 43,62 64,50" fill="#fff" />
      </svg>
    );
  }

  let bg = "#e81a6c", fg = "#fff", txt = brand.slice(0, 2).toUpperCase();
  if (b.includes("jio")) { bg = "#0a2885"; txt = "Jio"; }
  else if (b.includes("airtel")) { bg = "#e40000"; txt = "airtel"; }
  else if (/\bvi\b/.test(b)) { bg = "#ee2737"; fg = "#ffd100"; txt = "Vi"; }
  else if (b.includes("bsnl")) { bg = "#005baa"; txt = "BSNL"; }
  else if (b.includes("tata")) { bg = "#6a1b9a"; txt = "TP"; }
  else if (b.includes("dish")) { bg = "#f57c00"; txt = "d2h"; }
  else if (b.includes("sun")) { bg = "#d32f2f"; txt = "SUN"; }
  else if (b.includes("indane")) { bg = "#f37021"; txt = "OIL"; }
  else if (b.startsWith("hp gas")) { bg = "#004b87"; txt = "HP"; }
  else if (b.startsWith("bharat gas")) { bg = "#fdd835"; fg = "#0d47a1"; txt = "BG"; }
  else if (b.includes("irctc")) { bg = "#003366"; txt = "🚆"; }

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size > 40 ? 14 : "50%",
        background: bg,
        color: fg,
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        fontSize: txt.length > 3 ? 9.5 : 12.5,
        letterSpacing: -0.3,
        flex: "none",
        boxShadow: "0 2px 6px rgba(0,0,0,.12)",
      }}
    >
      {txt}
    </span>
  );
}
