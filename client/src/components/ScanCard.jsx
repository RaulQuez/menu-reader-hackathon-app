import { Link } from 'react-router'
import useSettings from '../hooks/useSettings'
import { menuStats } from '../lib/menuStats'
import { friendlyDate, plural } from '../lib/format'

// One row in "Recent scans". Tapping it reopens that menu so you can ask about
// it again. Counts are "avoid" and "ask" only, never "safe" (see menuStats.js).
export default function ScanCard({ scan }) {
  const { allergies } = useSettings()
  const { avoid, ask, total } = menuStats(scan.menu, allergies)
  const when = friendlyDate(scan.createdAt)

  // what a screen reader says for the whole card, in one natural sentence
  const label = allergies.length
    ? `${scan.name}, scanned ${when.toLowerCase()}, ${plural(scan.pages, "page")}. ${avoid} to avoid, ${ask} to ask about.`
    : `${scan.name}, scanned ${when.toLowerCase()}, ${plural(total, "dish")}.`

  return (
    <li>
      <Link to={`/menu/${scan.id}`} className="scan-card" aria-label={label}>
        <span className="scan-card-main">
          <span className="scan-card-name">{scan.name}</span>
          <span className="scan-card-meta">{when} · {plural(scan.pages, "page")}</span>
        </span>
        {allergies.length > 0 ? (
          <span className="scan-card-stats">
            <span className="stat-avoid">{avoid} avoid</span>
            <span className="stat-ask">{ask} ask</span>
          </span>
        ) : (
          <span className="scan-card-stats">{plural(total, "dish")}</span>
        )}
      </Link>
    </li>
  )
}
