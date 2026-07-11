import React from "react";
import { StarRating } from "./StarRating.jsx";
import { PricePill } from "./PricePill.jsx";

/** Menu drink card: rounded white thumbnail tile, serif name, stars, description, price pill. */
export function DrinkCard({ image, name, rating, description, price, onPress }) {
  return (
    <button
      onClick={onPress}
      style={{
        display: "flex", gap: "var(--space-4)", alignItems: "flex-start",
        width: "100%", textAlign: "left", cursor: "pointer", border: "none",
        background: "var(--surface-card)", boxShadow: "var(--shadow-card)",
        borderRadius: "var(--radius-card)", padding: "var(--card-padding)",
        transition: "transform var(--duration-press) var(--ease-soft)",
      }}
      onPointerDown={(e) => { e.currentTarget.style.transform = "scale(var(--press-scale))"; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = "none"; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = "none"; }}
    >
      <img
        src={image} alt=""
        style={{
          width: 120, height: 126, flexShrink: 0, objectFit: "cover",
          background: "var(--surface-tile)", borderRadius: "var(--radius-tile)",
          boxShadow: "var(--shadow-tile)",
        }}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
          <h3
            style={{
              flex: 1, margin: 0, fontFamily: "var(--font-serif)", fontWeight: 600,
              fontSize: "var(--text-drink-name)", lineHeight: "var(--leading-tight)",
              color: "var(--text-heading)",
            }}
          >
            {name}
          </h3>
          <PricePill price={price} />
        </div>
        <StarRating rating={rating} />
        <p
          style={{
            margin: 0, fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-size)", lineHeight: "var(--leading-body)",
            color: "var(--text-body)",
          }}
        >
          {description}
        </p>
      </div>
    </button>
  );
}
