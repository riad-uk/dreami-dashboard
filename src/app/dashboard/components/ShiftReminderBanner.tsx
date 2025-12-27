"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"

const DISMISS_KEY = "dreamiShiftReminderDismissedDate"

const todayISO = () => new Date().toISOString().slice(0, 10)

export default function ShiftReminderBanner() {
  const pathname = usePathname()
  const excluded = useMemo(() => pathname === "/dashboard" || pathname === "/dashboard/admin", [pathname])
  const [dismissedForToday, setDismissedForToday] = useState(true)
  const [hasShiftsToday, setHasShiftsToday] = useState(false)

  useEffect(() => {
    if (excluded) return
    const today = todayISO()
    try {
      const dismissedDate = localStorage.getItem(DISMISS_KEY)
      setDismissedForToday(dismissedDate === today)
    } catch {
      setDismissedForToday(false)
    }
  }, [excluded])

  useEffect(() => {
    if (excluded) return
    const today = todayISO()
    const check = async () => {
      try {
        const res = await fetch(`/api/rota/entries?date=${today}`, { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        const entries = Array.isArray(data.entries) ? data.entries : []
        setHasShiftsToday(entries.length > 0)
      } catch {}
    }
    check()
  }, [excluded, pathname])

  const dismiss = () => {
    const today = todayISO()
    try {
      localStorage.setItem(DISMISS_KEY, today)
    } catch {}
    setDismissedForToday(true)
  }

  if (excluded) return null
  if (hasShiftsToday) return null
  if (dismissedForToday) return null

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
      <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-amber-900">
          Reminder: please log your shift at the end of the day in <span className="font-semibold">ROTA</span>.
        </p>
        <button
          onClick={dismiss}
          className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
