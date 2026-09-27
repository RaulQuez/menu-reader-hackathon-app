import { Navigate, Outlet } from 'react-router'
import useSettings from '../hooks/useSettings'
import BottomNav from './BottomNav'

// Wraps the tab pages (Scan, Allergies): renders whichever tab is active
// (<Outlet/>) with the bottom nav underneath. Flow screens like /reading and
// /menu/:id are outside this layout, so the nav hides while you're at the table.
export default function TabLayout() {
  const { screenReader } = useSettings()

  // first launch: ask the screen-reader question before anything else
  if (screenReader === null) return <Navigate to="/welcome" replace />

  return (
    <div className="tab-layout">
      <Outlet />
      <BottomNav />
    </div>
  )
}
