import { useEffect, useRef } from 'react'

// Every screen calls this with its title and puts the returned ref on its <h1>.
// When the screen opens we (1) update the browser tab title and (2) move focus
// to the heading, so screen readers announce the new screen. Without this,
// changing routes in a single-page app is silent for blind users.
export default function usePageHeading(title) {
  const heading = useRef(null)

  useEffect(() => {
    document.title = title === "Menu Reader" ? title : `${title} · Menu Reader`
    heading.current?.focus()
  }, [title])

  return heading
}
