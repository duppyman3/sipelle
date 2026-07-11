import React from "react";

/** Row of 5 star glyphs. Supports halves (e.g. 4.5). Solid ink, as on the results screen. */
export function StarRating({ rating, size = 22 }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const filled = rating >= i;
    const half = !filled && rating >= i - 0.5;
    stars.push(
      <span key={i} style={{ position: "relative", fontSize: size, lineHeight: 1, color: "var(--ink)" }}>
        {filled ? "\u2605" : half ? (
          <span style={{ position: "relative", display: "inline-block" }}>
            <span>{"\u2606"}</span>
            <span style={{ position: "absolute", inset: 0, width: "50%", overflow: "hidden" }}>{"\u2605"}</span>
          </span>
        ) : "\u2606"}
      </span>
    );
  }
  return (
    <div role="img" aria-label={rating + " out of 5 stars"} style={{ display: "flex", gap: 3 }}>
      {stars}
    </div>
  );
}
