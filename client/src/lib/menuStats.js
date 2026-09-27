// Counts for a menu against the user's allergies, shown on each recent scan.
// Worked out every time it's shown (never saved), so changing your allergies
// updates every card straight away.
//
// We deliberately never count "safe" dishes: the app only sees the menu text,
// not the recipe, so it can't know a dish is safe.

export function menuStats(menu, allergies) {
  let avoid = 0 // a listed ingredient matches one of your allergies
  let ask = 0   // commonly contains one of your allergies, so ask the server

  for (const item of menu.items) {
    if (item.contains.some((a) => allergies.includes(a))) avoid++
    else if (item.possibly_contains.some((a) => allergies.includes(a))) ask++
  }
  return { avoid, ask, total: menu.items.length }
}
