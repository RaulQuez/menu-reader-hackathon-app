import { Link } from 'react-router'
import useSettings from '../hooks/useSettings'
import { listToText } from '../lib/allergens'

// "Checking for peanuts, shellfish and gluten": always visible on the home
// screen so users can trust what the app is (and isn't) checking.
export default function AllergySummary() {
  const { allergies } = useSettings()

  if (!allergies.length) {
    return (
      <p className="allergy-summary">
        No allergies set. <Link to="/settings">Add your allergies</Link>
      </p>
    )
  }
  return (
    <p className="allergy-summary">
      Checking for <strong>{listToText(allergies)}</strong>
    </p>
  )
}
