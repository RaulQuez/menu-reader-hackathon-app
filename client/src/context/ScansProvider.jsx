import { useState } from 'react'
import { ScansContext } from './contexts'
import { load, save } from '../lib/storage'

const MAX_SCANS = 50 // a parsed menu is ~10-30 KB; localStorage allows ~5 MB

// Short unique id. crypto.randomUUID only exists on HTTPS/localhost pages,
// so fall back to time + random for plain-HTTP testing on a phone.
function newId() {
  return crypto.randomUUID?.().slice(0, 8) ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// Menus the user has scanned (the "Recent scans" list). The server keeps no
// state, so this is the only copy of each parsed menu: /api/ask gets the menu
// from here with every question.
//
// Kept in React state AND localStorage: state so it works even when storage
// is blocked (private mode), storage so it survives closing the app.
export default function ScansProvider({ children }) {
  const [scans, setScans] = useState(() => load("scans", []))

  function persist(next) {
    // if storage is full, drop the oldest scans until it fits
    let list = next
    while (list.length && !save("scans", list)) list = list.slice(0, -1)
    return list
  }

  // scan = { menu, pages, overviewSpeech } from /api/parse; returns the new id
  function addScan(scan) {
    const entry = {
      id: newId(),
      createdAt: Date.now(),
      name: scan.menu.restaurant || "Menu",
      ...scan,
    }
    setScans((current) => persist([entry, ...current].slice(0, MAX_SCANS))) // newest first
    return entry.id
  }

  function removeScan(id) {
    setScans((current) => persist(current.filter((s) => s.id !== id)))
  }

  const getScan = (id) => scans.find((s) => s.id === id)

  const value = { scans, addScan, removeScan, getScan }
  return <ScansContext.Provider value={value}>{children}</ScansContext.Provider>
}
