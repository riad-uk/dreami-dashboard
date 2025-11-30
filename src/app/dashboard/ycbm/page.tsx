"use client"

import { useState, useEffect } from "react"
import { format, parse } from "date-fns"
import type { YCBMBooking } from "@/types/ycbm"

const formatDateLocal = (iso: string) => {
  const d = new Date(iso)
  const y = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric' }).format(d)
  const m = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', month: '2-digit' }).format(d)
  const da = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', day: '2-digit' }).format(d)
  return `${y}-${m}-${da}`
}

const formatTimeLocal = (iso: string) => {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
}

// Format reference with dashes every 4 characters
const formatReference = (ref: string) => {
  return ref.match(/.{1,4}/g)?.join('-') || ref
}

const formatDateInTZ = (iso: string, tz: string) => {
  const d = new Date(iso)
  const y = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric' }).format(d)
  const m = new Intl.DateTimeFormat('en-CA', { timeZone: tz, month: '2-digit' }).format(d)
  const da = new Intl.DateTimeFormat('en-CA', { timeZone: tz, day: '2-digit' }).format(d)
  return `${y}-${m}-${da}`
}

const parseHHmm = (s: string) => {
  const [h, m] = s.split(':')
  return Number(h) * 60 + Number(m)
}

const getSessionTime = (iso: string, tz: string, slots: string[]) => {
  const minutes = parseHHmm(formatTimeLocal(iso))
  let best = slots[0]
  let bestDiff = Math.abs(parseHHmm(best) - minutes)
  for (const s of slots) {
    const diff = Math.abs(parseHHmm(s) - minutes)
    if (diff < bestDiff) {
      best = s
      bestDiff = diff
    }
  }
  return best
}

const getStartISO = (booking: YCBMBooking) => {
  return booking.startsAtUTC || booking.startsAt || booking.starts
}

const formatTimeInTZ = (iso: string, tz: string) => {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
}

const getExactSlot = (booking: YCBMBooking, slots: string[]) => {
  const iso = getStartISO(booking)
  const tz = booking.timeZone || 'UTC'
  const hhmm = formatTimeInTZ(iso, tz)
  if (slots.includes(hhmm)) return hhmm
  return getSessionTime(iso, tz, slots)
}

const getCustomerName = (booking: YCBMBooking): string => {
  if (booking.customerName) return booking.customerName
  const title = booking.title || ""
  const fromTitle = title.split(' for ')[0].trim()
  if (fromTitle) return fromTitle
  return title
}

const parseUnits = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

// Calculate units (slots) based on appointment type
const getUnits = (booking: YCBMBooking): number => {
  // Prefer explicit unit counts returned by the API
  const unitCandidates = [
    parseUnits(booking.units),
    parseUnits(booking.unitCount),
    parseUnits(booking.quantity),
    parseUnits((booking as any).unitsBooked),
    parseUnits((booking as any).bookedUnits),
    parseUnits(booking.legacy?.appointmentTypes?.[0]?.units),
  ]

  for (const candidate of unitCandidates) {
    if (candidate !== null) return candidate
  }

  // Fallback to legacy heuristic based on appointment type name
  const appointmentType = booking.legacy?.appointmentTypes?.[0]?.name?.toLowerCase() || ""
  if (appointmentType.includes("sibling") || appointmentType.includes("child + sibling")) {
    return 2
  }
  return 1
}

// Calculate actual number of kids
// Sibling type = 2 kids per unit, others = 1 kid per unit
const getKids = (booking: YCBMBooking): number => {
  const units = getUnits(booking)
  const appointmentType = booking.legacy?.appointmentTypes?.[0]?.name?.toLowerCase() || ""
  
  // Sibling type means 2 kids per unit
  if (appointmentType.includes("sibling") || appointmentType.includes("child + sibling")) {
    return units * 2  // 1 unit = 2 kids, 2 units = 4 kids
  }
  // Other types: 1 kid per unit
  return units
}

// Get default date: current date, or next day if after 20:00
const getDefaultDate = (): string => {
  const now = new Date()
  const hour = now.getHours()

  if (hour >= 20) {
    // After 8 PM, show next day
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return format(tomorrow, "yyyy-MM-dd")
  }

  return format(now, "yyyy-MM-dd")
}

interface SessionGroup {
  time: string
  bookings: YCBMBooking[]
  totalUnits: number
  totalKids: number
  capacity: number
}

export default function YCBMPage() {
  const [bookings, setBookings] = useState<YCBMBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(getDefaultDate())
  const [showNoShowOnly, setShowNoShowOnly] = useState(false)
  const [noShowIds, setNoShowIds] = useState<Set<string>>(new Set())
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set())
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set())
  const [selectedSession, setSelectedSession] = useState<string | null>(null) // null = show all
  const [copiedRef, setCopiedRef] = useState<string | null>(null)

  const fetchBookings = async (date: string) => {
    setLoading(true)
    setError(null)

    try {
      const url = `/api/ycbm/bookings?date=${date}`

      const response = await fetch(url)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to fetch bookings")
      }

      const data = await response.json()
      console.log(`Received ${data.bookings?.length || 0} bookings for date ${date}`)
      if (data.bookings?.length > 0) {
        console.log('First booking sample:', {
          id: data.bookings[0].id,
          title: data.bookings[0].title,
          starts: data.bookings[0].starts,
          startsAt: data.bookings[0].startsAt,
          startsAtUTC: data.bookings[0].startsAtUTC,
          timeZone: data.bookings[0].timeZone,
          cancelled: data.bookings[0].cancelled
        })
      }
      setBookings(data.bookings || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const applyFlags = async () => {
      try {
        const res = await fetch('/api/booking-flags')
        if (!res.ok) return
        const data = await res.json()
        const flags: Record<string, { confirmed?: boolean; noShow?: boolean }> = data.flags || {}
        const ns = new Set<string>()
        const cf = new Set<string>()
        bookings.forEach(b => {
          const f = flags[b.id]
          if (f?.noShow) ns.add(b.id)
          if (f?.confirmed) cf.add(b.id)
        })
        setNoShowIds(ns)
        setConfirmedIds(cf)
      } catch {}
    }
    applyFlags()
  }, [bookings])

  // Track which bookings have been modified to avoid unnecessary saves
  const [modifiedBookings, setModifiedBookings] = useState<Set<string>>(new Set())

  useEffect(() => {
    const saveFlags = async () => {
      // Only save flags for bookings that have been modified
      const bookingsToSave = bookings.filter(b => modifiedBookings.has(b.id))
      
      for (const booking of bookingsToSave) {
        const payload: any = { bookingId: booking.id }
        payload.noShow = noShowIds.has(booking.id)
        payload.confirmed = confirmedIds.has(booking.id)
        await fetch('/api/booking-flags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
      
      // Clear modified set after saving
      if (bookingsToSave.length > 0) {
        setModifiedBookings(new Set())
      }
    }
    
    if (modifiedBookings.size > 0) {
      saveFlags()
    }
  }, [noShowIds, confirmedIds, bookings, modifiedBookings])

  useEffect(() => {
    fetchBookings(selectedDate)
  }, [selectedDate])

  // Toggle no-show status
  const toggleNoShow = (bookingId: string, bookingDate: string) => {
    // Only block changes if date is before today (allow changes on same day)
    const today = format(new Date(), "yyyy-MM-dd")
    if (bookingDate < today) {
      alert("Cannot modify bookings from past dates (before today)")
      return
    }

    // Mark this booking as modified
    setModifiedBookings(prev => new Set(prev).add(bookingId))

    setNoShowIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId)
      } else {
        newSet.add(bookingId)
        // Remove from confirmed if adding to no-show (mutual exclusivity)
        setConfirmedIds(prevConfirmed => {
          const newConfirmed = new Set(prevConfirmed)
          newConfirmed.delete(bookingId)
          return newConfirmed
        })
      }
      return newSet
    })
  }

  // Toggle confirmed status
  const toggleConfirmed = (bookingId: string, bookingDate: string) => {
    // Only block changes if date is before today (allow changes on same day)
    const today = format(new Date(), "yyyy-MM-dd")
    if (bookingDate < today) {
      alert("Cannot modify bookings from past dates (before today)")
      return
    }

    // Mark this booking as modified
    setModifiedBookings(prev => new Set(prev).add(bookingId))

    setConfirmedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId)
      } else {
        newSet.add(bookingId)
        // Remove from no-show if adding to confirmed (mutual exclusivity)
        setNoShowIds(prevNoShow => {
          const newNoShow = new Set(prevNoShow)
          newNoShow.delete(bookingId)
          return newNoShow
        })
      }
      return newSet
    })
  }

  // Fetch booking details (email, phone) using intent ID
  const fetchBookingDetails = async (booking: YCBMBooking) => {
    setLoadingDetails(prev => new Set(prev).add(booking.id))
    try {
      const response = await fetch(`/api/ycbm/booking/${booking.intentId}`)
      if (response.ok) {
        const details = await response.json()
        // Update booking with customer details
        setBookings(prev => prev.map(b =>
          b.id === booking.id
            ? { ...b, customerEmail: details.email, customerPhone: details.phone, customerName: details.name || b.customerName }
            : b
        ))
      }
    } catch (err) {
      console.error('Failed to fetch booking details:', err)
    } finally {
      setLoadingDetails(prev => {
        const newSet = new Set(prev)
        newSet.delete(booking.id)
        return newSet
      })
    }
  }

  // Auto-fetch booking details (including full name) when bookings are loaded
  useEffect(() => {
    const fetchAllDetails = async () => {
      const bookingsNeedingDetails = bookings.filter(
        b => b.intentId && !b.customerName && !loadingDetails.has(b.id)
      )
      
      // Fetch details for all bookings in parallel (with a limit to avoid overwhelming the API)
      const batchSize = 10
      for (let i = 0; i < bookingsNeedingDetails.length; i += batchSize) {
        const batch = bookingsNeedingDetails.slice(i, i + batchSize)
        await Promise.all(batch.map(booking => fetchBookingDetails(booking)))
      }
    }
    
    if (bookings.length > 0) {
      fetchAllDetails()
    }
  }, [bookings.length]) // Only run when bookings count changes (new fetch)

  // Copy reference to clipboard
  const copyReference = async (ref: string) => {
    try {
      await navigator.clipboard.writeText(ref)
      setCopiedRef(ref)
      setTimeout(() => setCopiedRef(null), 2000) // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Export no-shows to CSV
  const exportNoShowsToCSV = () => {
    const noShowBookings = bookings.filter(b => noShowIds.has(b.id) && !b.cancelled)

    if (noShowBookings.length === 0) {
      alert('No no-shows to export')
      return
    }

    const headers = ['Date', 'Time', 'Name', 'Reference', 'Type', 'Units', 'Email', 'Phone']
    const rows = noShowBookings.map(booking => {
      const units = getUnits(booking)
      const customerName = getCustomerName(booking)
      const type = booking.legacy?.appointmentTypes?.[0]?.name || 'N/A'

      return [
        formatDateLocal(getStartISO(booking)),
        formatTimeLocal(getStartISO(booking)),
        customerName,
        booking.ref,
        type,
        units.toString(),
        booking.customerEmail || 'N/A',
        booking.customerPhone || 'N/A'
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `no-shows-${selectedDate}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value
    if (date) {
      setSelectedDate(date)
    }
  }

  const handleToday = () => {
    setSelectedDate(format(new Date(), "yyyy-MM-dd"))
  }

  const handleYesterday = () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    setSelectedDate(format(yesterday, "yyyy-MM-dd"))
  }

  const handleTomorrow = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setSelectedDate(format(tomorrow, "yyyy-MM-dd"))
  }

  // Define all possible session times
  const allSessionTimes = ["09:30", "11:30", "13:30", "15:30"]

  console.log(`Starting to filter ${bookings.length} bookings for selectedDate: ${selectedDate}`)

  // Filter and group bookings by session time
  const bookingsByTime = bookings.reduce((acc: Record<string, YCBMBooking[]>, booking) => {
    if (booking.cancelled) return acc // Skip cancelled bookings

    // Filter by no-show if enabled (use local state)
    if (showNoShowOnly && !noShowIds.has(booking.id)) return acc

    // Use London timezone for date comparison to match the selected date
    const startISO = getStartISO(booking)
    const bookingDate = formatDateLocal(startISO)
    
    if (bookingDate !== selectedDate) {
      console.log(`Filtering out booking: ${booking.id}, startISO=${startISO}, bookingDate=${bookingDate}, selectedDate=${selectedDate}, timeZone=${booking.timeZone}`)
      return acc
    }
    
    console.log(`✓ Including booking: ${booking.id}, bookingDate=${bookingDate}`)

    const timeOnly = getExactSlot(booking, allSessionTimes)

    if (!acc[timeOnly]) {
      acc[timeOnly] = []
    }
    acc[timeOnly].push(booking)

    return acc
  }, {})

  // Create session groups for all time slots (even empty ones)
  const groupedSessions: SessionGroup[] = allSessionTimes.map(time => {
    const sessionBookings = bookingsByTime[time] || []
    const totalUnits = sessionBookings.reduce((sum, booking) => sum + getUnits(booking), 0)
    const totalKids = sessionBookings.reduce((sum, booking) => sum + getKids(booking), 0)

    return {
      time,
      bookings: sessionBookings,
      totalUnits,
      totalKids,
      capacity: 11
    }
  })

  console.log(`Grouped into ${groupedSessions.length} sessions:`, groupedSessions.map(s => `${s.time}: ${s.bookings.length} bookings, ${s.totalUnits} units`))
  console.log('bookingsByTime keys:', Object.keys(bookingsByTime))

  const totalBookings = groupedSessions.reduce((sum, s) => sum + s.bookings.length, 0)
  const totalUnitsAll = groupedSessions.reduce((sum, s) => sum + s.totalUnits, 0)
  const totalKids = groupedSessions.reduce((sum, s) => sum + s.totalKids, 0)
  const noShowCount = groupedSessions.reduce((sum, s) => sum + s.bookings.filter(b => noShowIds.has(b.id)).length, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        {/* Action buttons group */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportNoShowsToCSV}
            disabled={noShowCount === 0}
            className="inline-flex items-center rounded-lg bg-[#557355] px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-[#4a6349] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Export No-Shows
          </button>
          <button
            onClick={() => setShowNoShowOnly(!showNoShowOnly)}
            className={`inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-all ${
              showNoShowOnly
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
            }`}
          >
            {showNoShowOnly ? 'Show All' : 'No-Shows Only'}
          </button>
        </div>

        {/* Date navigation group */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="block rounded-lg border-0 px-4 py-2.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:leading-6"
          />
          <button
            onClick={handleYesterday}
            className="inline-flex items-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-[#557355] hover:text-white transition-all"
          >
            Yesterday
          </button>
          <button
            onClick={handleToday}
            className="inline-flex items-center rounded-lg bg-[#557355] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#4a6349] transition-all"
          >
            Today
          </button>
          <button
            onClick={handleTomorrow}
            className="inline-flex items-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-[#557355] hover:text-white transition-all"
          >
            Tomorrow
          </button>
          <button
            onClick={() => fetchBookings(selectedDate)}
            className="inline-flex items-center rounded-lg bg-[#b4cdb4] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#a0c0a0] transition-all"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-gray-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">Selected Date</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">
                    {format(parse(selectedDate, "yyyy-MM-dd", new Date()), "PPP")}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-gray-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">Total Bookings</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">
                    {totalBookings}
                    <span className="text-sm text-gray-500 ml-1">({totalKids} kids)</span>
                    <div className="text-sm font-medium text-gray-600">
                      {totalUnitsAll} units total
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-gray-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">No-Shows</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">
                    {noShowCount}
                    {noShowCount > 0 && (
                      <span className="ml-2 text-sm text-gray-600">
                        ({((noShowCount / totalBookings) * 100).toFixed(1)}%)
                      </span>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session Filter Buttons */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Filter by Session</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            onClick={() => setSelectedSession(null)}
            className={`col-span-2 sm:col-span-1 rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
              selectedSession === null
                ? 'bg-[#557355] text-white hover:bg-[#4a6349] focus-visible:outline-[#557355]'
                : 'bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:ring-[#557355]'
            }`}
          >
            All Sessions
          </button>
          {allSessionTimes.map((time) => (
            <button
              key={time}
              onClick={() => setSelectedSession(time)}
              className={`rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                selectedSession === time
                  ? 'bg-[#557355] text-white hover:bg-[#4a6349] focus-visible:outline-[#557355]'
                  : 'bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:ring-[#557355]'
              }`}
            >
              {time}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-md p-4">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedSessions
            .filter(session => selectedSession === null || session.time === selectedSession)
            .map((session, idx) => {
            const slotsLeft = session.capacity - session.totalUnits
            const percentFull = (session.totalUnits / session.capacity) * 100

            return (
              <div key={idx} className="space-y-4">
                {/* Session Header - Horizontal */}
                <div className="overflow-hidden rounded-xl bg-gradient-to-r from-[#557355] to-[#6b8f6b] shadow-lg">
                  <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                    <h3 className="text-xl font-bold text-white tracking-tight">
                      <span className="inline-flex flex-col items-center justify-center rounded-lg bg-[#f4a11f] px-4 py-2 text-white shadow-inner min-h-[72px]">
                        <span className="text-xs font-semibold uppercase tracking-wide text-white/80">Time</span>
                        <span className="text-lg font-bold">{session.time}</span>
                      </span>
                    </h3>
                    <div className="flex flex-wrap items-stretch gap-4">
                      <div className="rounded-lg bg-[#3d5a3d] px-4 py-2 shadow-inner flex flex-col items-center justify-center min-h-[72px]">
                        <div className="text-xs font-semibold uppercase tracking-wide text-white/80">Units</div>
                        <div className="text-lg font-bold text-white">
                          {session.totalUnits}/{session.capacity}
                        </div>
                      </div>
                      <div className="flex gap-3 items-stretch">
                        <div className="rounded-lg bg-[#3d5a3d] px-4 py-2 shadow-inner flex flex-col items-center justify-center min-h-[72px] text-center">
                          <div className="text-xs font-semibold uppercase tracking-wide text-white/80">Bookings</div>
                          <div className="text-lg font-bold text-white">{session.bookings.length}</div>
                        </div>
                        <div className="rounded-lg bg-[#3d5a3d] px-4 py-2 shadow-inner flex flex-col items-center justify-center min-h-[72px] text-center">
                          <div className="text-xs font-semibold uppercase tracking-wide text-white/80">Kids</div>
                          <div className="text-lg font-bold text-white">{session.totalKids}</div>
                        </div>
                      </div>
                      <div className={`text-xs font-medium flex items-center ${
                        slotsLeft === 0 ? 'text-red-200' :
                        slotsLeft <= 2 ? 'text-yellow-200' :
                        'text-blue-100'
                      }`}>
                        {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} left
                      </div>
                    </div>
                    {/* Capacity bar */}
                    <div className="flex-1 bg-white/30 rounded-full h-3 overflow-hidden min-w-[120px] shadow-inner">
                      <div
                        className={`h-full transition-all duration-500 ${
                          percentFull >= 100 ? 'bg-red-400' :
                          percentFull >= 80 ? 'bg-yellow-400' :
                          'bg-green-400'
                        }`}
                        style={{ width: `${Math.min(percentFull, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="px-6 pb-4">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-white/90">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-3 w-3 rounded-full bg-pink-200 border border-pink-400" /> Sibling
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-3 w-3 rounded-full bg-yellow-200 border border-yellow-400" /> Baby
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-3 w-3 rounded-full bg-blue-200 border border-blue-400" /> Standard
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-3 w-3 rounded-full bg-purple-300 border border-purple-500" /> Exclusive hire
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bookings Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {session.bookings.length === 0 ? (
                    <div className="col-span-full rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
                      <p className="text-sm font-medium text-gray-500">No bookings for this session</p>
                    </div>
                  ) : (
                    session.bookings.map((booking) => {
                        const units = getUnits(booking)
                        // Extract customer name from title (e.g., "Charlotte for Single Child" -> "Charlotte")
                        const customerName = getCustomerName(booking)
                        
                        // Check if this is an exclusive hire booking
                        const appointmentType = booking.legacy?.appointmentTypes?.[0]?.name || ""
                        const appointmentTypeLower = appointmentType.toLowerCase()
                        const isExclusiveHire = appointmentTypeLower.includes("dreami exclusive hire")
                        const isSiblingBooking = appointmentTypeLower.includes("sibling")
                        const isBabyBooking = appointmentTypeLower.includes("baby")

                        const isNoShow = noShowIds.has(booking.id)
                        const isConfirmed = confirmedIds.has(booking.id)
                        const hasDetails = booking.customerEmail || booking.customerPhone
                        const isLoadingDetails = loadingDetails.has(booking.id)

                        return (
                          <div 
                            key={booking.id} 
                            className={`rounded-xl p-5 transition-all duration-200 ${
                              isExclusiveHire 
                                ? 'col-span-full bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 ring-2 ring-purple-400 shadow-lg hover:shadow-xl' 
                                : 'bg-white shadow-sm hover:shadow-md ring-1 ring-gray-200 hover:ring-gray-300'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="font-semibold text-gray-900 flex items-center justify-between flex-wrap gap-2">
                                <span className={isExclusiveHire ? 'text-lg' : ''}>{customerName}</span>
                                <div className="flex items-center gap-2">
                                  {isExclusiveHire && (
                                    <span className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded-full font-bold">
                                      ⭐ EXCLUSIVE HIRE
                                    </span>
                                  )}
                                  {isNoShow && (
                                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                                      No Show
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* Reference with copy button */}
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-mono tracking-wide text-gray-800">
                                  Ref: <span className="font-semibold">{formatReference(booking.ref)}</span>
                                </div>
                                <button
                                  onClick={() => copyReference(booking.ref)}
                                  className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 transition-all"
                                  title="Copy reference"
                                >
                                  {copiedRef === booking.ref ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                              {booking.legacy?.appointmentTypes && booking.legacy.appointmentTypes.length > 0 && (
                                <div className="text-xs">
                                  <span className="text-gray-600 mr-2">Type:</span>
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-semibold ${
                                    isExclusiveHire ? 'bg-purple-200 text-purple-900 ring-1 ring-purple-300' :
                                    isSiblingBooking ? 'bg-pink-100 text-pink-800 ring-1 ring-pink-200' :
                                    isBabyBooking ? 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200' :
                                    'bg-blue-100 text-blue-800 ring-1 ring-blue-200'
                                  }`}>
                                    {booking.legacy.appointmentTypes[0].name} x {units} unit{units !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              )}

                              {/* Customer details */}
                              {hasDetails ? (
                                <div className="space-y-0.5 text-xs text-gray-600 pt-1">
                                  {booking.customerEmail && (
                                    <div>
                                      <a
                                        href={`mailto:${booking.customerEmail}`}
                                        className="text-blue-600 hover:underline break-all"
                                      >
                                        {booking.customerEmail}
                                      </a>
                                    </div>
                                  )}
                                  {booking.customerPhone && (
                                    <div>
                                      <a
                                        href={`tel:${booking.customerPhone}`}
                                        className="text-blue-600 hover:underline"
                                      >
                                        {booking.customerPhone}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => fetchBookingDetails(booking)}
                                  disabled={isLoadingDetails}
                                  className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                                >
                                  {isLoadingDetails ? 'Loading...' : 'Load contact info'}
                                </button>
                              )}

                              {/* Toggle buttons - Hide for exclusive hire bookings */}
                              {!isExclusiveHire && (
                                <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                                  <button
                                    onClick={() => toggleNoShow(booking.id, selectedDate)}
                                    className={`flex-1 text-xs py-1 px-2 rounded ${
                                      isNoShow
                                        ? 'bg-red-100 text-red-700 border border-red-300'
                                        : 'bg-gray-100 text-gray-600 border border-gray-300'
                                    }`}
                                  >
                                    {isNoShow ? '✓ No Show' : 'No Show'}
                                  </button>
                                  <button
                                    onClick={() => toggleConfirmed(booking.id, selectedDate)}
                                    className={`flex-1 text-xs py-1 px-2 rounded ${
                                      isConfirmed
                                        ? 'bg-green-100 text-green-700 border border-green-300'
                                        : 'bg-gray-100 text-gray-600 border border-gray-300'
                                    }`}
                                  >
                                    {isConfirmed ? '✓ Confirmed' : 'Confirm'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}
