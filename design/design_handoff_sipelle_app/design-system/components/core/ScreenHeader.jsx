import React from "react";

/** Serif screen title with optional back arrow. Used on the results screen ("Union Square"). */
export function ScreenHeader({ title, onBack, backIcon }) {
  return (
    <header style={{ padding: "12px var(--screen-gutter) 8px" }}>
      {onBack ? (
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            background: "none", border: "none", padding: 8, margin: "-8px 0 0 -8px",
            minWidth: "var(--tap-min)", minHeight: "var(--tap-min)",
            color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center",
          }}
        >
          {backIcon || <span style={{ fontSize: 28, lineHeight: 1 }}>&#8592;</span>}
        </button>
      ) : null}
      <h1
        style={{
          margin: "4px 0 0", textAlign: "center",
          fontFamily: "var(--font-serif)", fontWeight: 600,
          fontSize: "var(--text-screen-title)", lineHeight: "var(--leading-tight)",
          color: "var(--text-heading)",
        }}
      >
        {title}
      </h1>
    </header>
  );
}
