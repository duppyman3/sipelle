// Native: install the synchronous SQLite-backed localStorage polyfill.
// The .web.ts sibling replaces this on web, where the browser's own
// localStorage exists and pulling expo-sqlite into the web bundle would
// drag in wasm assets Metro isn't configured for.
import 'expo-sqlite/localStorage/install';
