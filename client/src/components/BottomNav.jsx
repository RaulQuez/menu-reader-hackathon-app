import { NavLink } from 'react-router'
import useSettings from '../hooks/useSettings'
import { CameraIcon, SettingsIcon } from './Icons'

// The bottom tab bar. NavLink adds aria-current="page" to the active tab
// automatically, which is how screen readers know which tab you're on
// (and what our CSS uses to color it).
export default function BottomNav() {
  const { allergies } = useSettings()
  const count = allergies.length

  return (
    <nav className="bottom-nav" aria-label="Main">
      {/* `end` makes Scan active only on "/" exactly, not on every page */}
      <NavLink to="/" end className="tab">
        <CameraIcon />
        <span>Scan</span>
      </NavLink>

      {/* language, allergies and screen-reader mode; the badge still shows how
          many allergies are being checked, since that's the most important setting */}
      <NavLink
        to="/settings"
        className="tab"
        // without this a screen reader would just say "Settings 3"
        aria-label={count ? `Settings, ${count} allergies selected` : "Settings, no allergies selected"}
      >
        <span className="tab-icon">
          <SettingsIcon />
          {count > 0 && <span className="badge" aria-hidden="true">{count}</span>}
        </span>
        <span>Settings</span>
      </NavLink>
    </nav>
  )
}
