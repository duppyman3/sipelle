import React from "react";

/** Round watercolor category chip with hand-written label ("Citrus", "Beer", "Exotic"). */
export function CategoryChip({ image, label, onPress, size = 150 }) {
  return (
    <button
      onClick={onPress}
      style={{
        background: "none", border: "none", padding: 0, cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
        transition: "transform var(--duration-press) var(--ease-soft)",
      }}
      onPointerDown={(e) => { e.currentTarget.style.transform = "scale(var(--press-scale))"; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = "none"; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = "none"; }}
    >
      <img src={image} alt="" style={{ width: size, height: size, borderRadius: "var(--radius-full)" }} />
      <span
        style={{
          fontFamily: "var(--font-hand)", fontWeight: 600,
          fontSize: "var(--text-label)", color: "var(--ink)",
        }}
      >
        {label}
      </span>
    </button>
  );
}
