import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import AllergySummary from '../components/AllergySummary'
import ScanCard from '../components/ScanCard'
import ScanHero from '../components/ScanHero'
import { PhotosIcon } from '../components/Icons'
import useScans from '../hooks/useScans'
import usePageHeading from '../hooks/usePageHeading'
import useSettings from '../hooks/useSettings'
import { speak } from '../lib/speech'

const RECENT_COUNT = 3 // how many scans show before "See all"

// The Scan tab ("/"): scan a new menu, or reopen a recent one.
// The recent scans list doubles as the app's history.
export default function HomePage() {
  const heading = usePageHeading("Menu Reader")
  const navigate = useNavigate()
  const { scans } = useScans()
  const { screenReader } = useSettings()
  const [showAll, setShowAll] = useState(false)

  // hidden <input type="file">s; our buttons "click" them to open the picker
  const cameraInput = useRef(null)
  const galleryInput = useRef(null)

  function openCamera() {
    // speaking during the tap also unlocks audio on iPhones, so the replies
    // that arrive later (after the upload) are allowed to play
    if (!screenReader) speak("Opening the camera. Hold the phone about a foot above the menu.")
    cameraInput.current.click()
  }

  function onPhotosChosen(event) {
    const files = [...event.target.files].slice(0, 4)
    event.target.value = "" // reset, so picking the same photo again still fires onChange
    if (!files.length) return
    // the Reading screen does the upload; File objects can travel in router state
    navigate("/reading", { state: { files } })
  }

  const visibleScans = showAll ? scans : scans.slice(0, RECENT_COUNT)

  return (
    <main className="home">
      <section className="home-hero">
        <h1 ref={heading} tabIndex={-1}>Menu Reader</h1>
        <AllergySummary />
        <ScanHero onClick={openCamera} />
        {/* a <button>, not a link: it opens the photo picker, it doesn't go anywhere */}
        <button className="link-button" onClick={() => galleryInput.current.click()}>
          <PhotosIcon size={24} />
          Or choose up to 4 photos
        </button>
      </section>

      <section className="recent" aria-labelledby="recent-heading">
        <div className="recent-header">
          <h2 id="recent-heading">Recent scans</h2>
          {scans.length > RECENT_COUNT && (
            <button className="text-button" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
              {showAll ? "Show fewer" : `See all (${scans.length})`}
            </button>
          )}
        </div>

        {scans.length ? (
          <ul className="scan-list">
            {visibleScans.map((scan) => <ScanCard key={scan.id} scan={scan} />)}
          </ul>
        ) : (
          <p className="empty">Menus you scan show up here, so you can ask about them again later.</p>
        )}
      </section>

      {/* capture="environment" opens the back camera directly on phones */}
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onPhotosChosen} />
      <input ref={galleryInput} type="file" accept="image/*" multiple hidden onChange={onPhotosChosen} />
    </main>
  )
}
