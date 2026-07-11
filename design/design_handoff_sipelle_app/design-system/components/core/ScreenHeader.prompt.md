Serif screen title with optional back arrow, as on the results screen.

```jsx
<ScreenHeader title="Union Square" onBack={() => nav.pop()} />
```

Omit `onBack` for root screens — the arrow disappears.
