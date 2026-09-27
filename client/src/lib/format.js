// "Today", "Yesterday", or "Sep 21" for a timestamp
export function friendlyDate(timestamp) {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`
}
