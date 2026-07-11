import React from "react";

/**
 * Bottom tab bar: 3 line icons on white, active tab tinted rose.
 * Icons are passed in (use Lucide: house, search, circle-user-round; stroke 2).
 */
export function TabBar({ tabs, activeId, onSelect }) {
  return (
    <nav
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-around",
        height: "var(--tabbar-height)", background: "#FFFFFF",
        borderTop: "1px solid rgba(0,0,0,0.05)",
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect && onSelect(tab.id)}
            aria-label={tab.label}
            aria-current={active ? "page" : undefined}
            style={{
              background: "none", border: "none", cursor: "pointer",
              minWidth: "var(--tap-min)", minHeight: "var(--tap-min)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: active ? "var(--tab-active)" : "var(--tab-inactive)",
            }}
          >
            {tab.icon}
          </button>
        );
      })}
    </nav>
  );
}
