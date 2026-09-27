// The allergens a user can pick. Must match ALLERGENS in server/menu.py,
// because the server only understands these exact names.
export const ALLERGENS = [
  "peanuts", "tree nuts", "milk", "egg", "wheat", "gluten", "soy", "sesame", "fish", "shellfish",
]

// "peanuts, shellfish and gluten" (reads naturally when spoken or shown)
export function listToText(items) {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
}
