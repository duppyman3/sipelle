Primary home action — watercolor blob with camera icon + hand-written label.

```jsx
<ScanAction image="assets/scan-menu-blob.png" onPress={openScanner} />
```

Prefer the pre-rendered PNG; the CSS-blob fallback (pass `icon` + `label`) is for when the artwork can't ship.
