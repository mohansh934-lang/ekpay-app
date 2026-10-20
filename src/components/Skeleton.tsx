"use client";

/** Shimmer skeleton placeholders — loading ka asli feel (YouTube/Instagram jaisa) */
export function SkeletonLine({ w = "100%", h = 14 }: { w?: string | number; h?: number }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: 7 }} />;
}

export function SkeletonCircle({ size = 38 }: { size?: number }) {
  return <div className="skel" style={{ width: size, height: size, borderRadius: "50%" }} />;
}

export function SkeletonCard() {
  return (
    <div className="c p" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SkeletonLine w="60%" h={16} />
      <SkeletonLine w="100%" />
      <SkeletonLine w="80%" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="row" style={{ borderBottom: "1px solid var(--ln)" }}>
      <SkeletonCircle />
      <div className="m" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <SkeletonLine w="55%" h={13} />
        <SkeletonLine w="35%" h={11} />
      </div>
      <SkeletonLine w={52} h={14} />
    </div>
  );
}

export function SkeletonHero() {
  return (
    <div className="hero" style={{ minHeight: 130 }}>
      <SkeletonLine w="40%" h={12} />
      <div style={{ margin: "12px 0" }}><SkeletonLine w="50%" h={28} /></div>
      <div style={{ display: "flex", gap: 6 }}>
        <SkeletonLine w={90} h={24} />
        <SkeletonLine w={90} h={24} />
        <SkeletonLine w={90} h={24} />
      </div>
    </div>
  );
}

/** Full home screen skeleton — jab data load ho raha ho */
export function HomeScreenSkeleton() {
  return (
    <>
      <SkeletonHero />
      <div className="qa">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <SkeletonCircle size={55} />
            <SkeletonLine w={42} h={10} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}><SkeletonLine w={140} h={14} /></div>
      <div className="c">
        {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
      </div>
    </>
  );
}

