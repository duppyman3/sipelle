import React from "react";

/** Raised cream price pill ("$14"), sits at the top-right of a DrinkCard. */
export function PricePill({ price }) {
  return (
    <span
      style={{
        background: "var(--surface-pill)", boxShadow: "var(--shadow-pill)",
        borderRadius: "var(--radius-pill)", padding: "8px 14px",
        fontFamily: "var(--font-body)", fontWeight: 700,
        fontSize: "var(--text-price)", color: "var(--ink)", whiteSpace: "nowrap",
      }}
    >
      {price}
    </span>
  );
}
