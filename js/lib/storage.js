// Remembers small preferences (game mode, calculator inputs, checklist) in this
// browser. Storage can be blocked (private windows), so every call is wrapped
// and simply falls back to the default.

const PREFIX = 'btd6hub:';

export function recall(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function remember(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the page still works, it just won't remember.
  }
}
