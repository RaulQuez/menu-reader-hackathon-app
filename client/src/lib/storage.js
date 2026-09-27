// localStorage wrappers. Every call can throw (private browsing, storage full,
// blocked by the browser), and the app must keep working when it does, just
// without remembering things between visits.

export function load(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value)
  } catch {
    return fallback
  }
}

// returns true if it saved, so callers can react to a full storage
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
