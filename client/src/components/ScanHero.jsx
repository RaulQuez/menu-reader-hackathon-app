import { CameraIcon } from './Icons'

// The big yellow "Scan a menu" card. The whole card is ONE button, so it's
// a huge target that's easy to hit without looking closely.
export default function ScanHero({ onClick }) {
  return (
    <button className="scan-hero" onClick={onClick}>
      <span className="scan-hero-text">
        <span className="scan-hero-title">Scan a menu</span>
        <span className="scan-hero-sub">Opens the camera</span>
      </span>
      <span className="scan-hero-icon">
        <CameraIcon size={36} />
      </span>
    </button>
  )
}
