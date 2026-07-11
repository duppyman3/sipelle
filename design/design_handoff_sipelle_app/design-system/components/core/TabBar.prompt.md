Bottom tab bar — 3 line icons on white, active tab tinted rose.

```jsx
<TabBar
  tabs={[
    { id: "home", label: "Home", icon: <House /> },
    { id: "search", label: "Search", icon: <Search /> },
    { id: "profile", label: "Profile", icon: <CircleUserRound /> },
  ]}
  activeId="home"
  onSelect={setTab}
/>
```

Icons come from Lucide (see readme ICONOGRAPHY).
