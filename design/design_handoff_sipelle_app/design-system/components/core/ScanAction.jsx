import React from "react";

/** Primary home action: watercolor blob with an icon and hand-written label ("Scan Menu"). */
export function ScanAction({ label = "Scan Menu", icon, onPress, image, size = 260 }) {
  return (
    <button
      onClick={onPress}
      aria-label={label}
      style={{
        position: "relative", width: size, height: size,
        background: "none", border: "none", padding: 0, cursor: "pointer",
        transition: "transform var(--duration-press) var(--ease-soft)",
      }}
      onPointerDown={(e) => { e.currentTarget.style.transform = "scale(var(--press-scale))"; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = "none"; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = "none"; }}
    >
      {/* Pre-rendered blob (assets/scan-menu-blob.png) already contains icon + label. */}
      {image ? (
        <img src={image} alt="" style={{ width: "100%", height: "100%" }} />
      ) : (
        <span
          style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 10,
            background: "radial-gradient(circle at 35% 35%, var(--wash-blush), var(--wash-mint))",
            borderRadius: "42% 58% 55% 45% / 50% 44% 56% 50%",
            color: "var(--ink)",
          }}
        >
          {icon}
          <span style={{ fontFamily: "var(--font-hand)", fontWeight: 600, fontSize: 34 }}>{label}</span>
        </span>
      )}
    </button>
  );
}
