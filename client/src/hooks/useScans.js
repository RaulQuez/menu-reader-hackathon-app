import { useContext } from 'react'
import { ScansContext } from '../context/contexts'

// const { scans, addScan, removeScan, getScan } = useScans()
export default function useScans() {
  const scans = useContext(ScansContext)
  if (!scans) throw new Error("useScans must be used inside <ScansProvider>")
  return scans
}
