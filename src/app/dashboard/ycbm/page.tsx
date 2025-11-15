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

// Calculate units (slots) based on appointment type
const getUnits = (booking: YCBMBooking): number => {
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

  useEffect(() => {
    const saveFlags = async () => {
      // Save flags for all current bookings (not just the ones in the sets)
      // This ensures deselected flags are saved as false
      for (const booking of bookings) {
        const payload: any = { bookingId: booking.id }
        payload.noShow = noShowIds.has(booking.id)
        payload.confirmed = confirmedIds.has(booking.id)
        await fetch('/api/booking-flags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
    }
    if (bookings.length > 0) {
      saveFlags()
    }
  }, [noShowIds, confirmedIds, bookings])

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
            ? { ...b, customerEmail: details.email, customerPhone: details.phone }
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
      const customerName = booking.title.split(' for ')[0]
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
  const totalKids = groupedSessions.reduce((sum, s) => sum + s.totalKids, 0)
  const noShowCount = groupedSessions.reduce((sum, s) => sum + s.bookings.filter(b => noShowIds.has(b.id)).length, 0)

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        {/* Action buttons group */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportNoShowsToCSV}
            disabled={noShowCount === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-[#557355] border border-[#557355] rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export No-Shows
          </button>
          <button
            onClick={() => setShowNoShowOnly(!showNoShowOnly)}
            className={`px-4 py-2 text-sm font-medium rounded-md border ${
              showNoShowOnly
                ? 'bg-red-600 text-white border-red-600'
                : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
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
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleYesterday}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-400 rounded-md hover:bg-gray-200"
          >
            Yesterday
          </button>
          <button
            onClick={handleToday}
            className="px-4 py-2 text-sm font-medium text-white bg-[#557355] border border-[#557355] rounded-md hover:bg-[#3d5a3d]"
          >
            Today
          </button>
          <button
            onClick={handleTomorrow}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-blue-100 border border-blue-400 rounded-md hover:bg-blue-200"
          >
            Tomorrow
          </button>
          <button
            onClick={() => fetchBookings(selectedDate)}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-purple-600 rounded-md hover:bg-purple-700"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-sm text-blue-800">
            <strong>{format(parse(selectedDate, "yyyy-MM-dd", new Date()), "PPPP")}</strong>
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-sm text-green-800">
            Total Bookings: <strong>{totalBookings}</strong> ({totalKids} kids)
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">
            No-Shows: <strong>{noShowCount}</strong>
            {noShowCount > 0 && ` (${((noShowCount / totalBookings) * 100).toFixed(1)}%)`}
          </p>
        </div>
      </div>

      {/* Session Filter Buttons */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          onClick={() => setSelectedSession(null)}
          className={`col-span-2 sm:col-span-1 px-4 py-3 text-sm font-semibold rounded-lg border-2 transition-all ${
            selectedSession === null
              ? 'bg-[#557355] text-white border-[#557355] shadow-lg'
              : 'bg-white text-gray-700 border-gray-300 hover:border-[#557355] hover:text-[#557355]'
          }`}
        >
          All Sessions
        </button>
        {allSessionTimes.map((time) => (
          <button
            key={time}
            onClick={() => setSelectedSession(time)}
            className={`px-4 py-3 text-sm font-semibold rounded-lg border-2 transition-all ${
              selectedSession === time
                ? 'bg-[#557355] text-white border-[#557355] shadow-lg'
                : 'bg-white text-gray-700 border-gray-300 hover:border-[#557355] hover:text-[#557355]'
            }`}
          >
            {time}
          </button>
        ))}
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
              <div key={idx} className="space-y-3">
                {/* Session Header - Horizontal */}
                <div className="bg-gradient-to-r from-[#557355] to-[#6b8f6b] px-4 py-3 rounded-lg shadow flex flex-wrap items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-white">
                    {session.time}
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="text-white text-xl font-bold bg-[#3d5a3d] px-3 py-2 rounded">
                      {session.totalUnits}/{session.capacity}
                    </div>
                    <div className="flex gap-2">
                      <div className="bg-white/20 rounded px-3 py-1">
                        <div className="text-white text-xs font-semibold">Bookings</div>
                        <div className="text-white text-sm font-bold">{session.bookings.length}</div>
                      </div>
                      <div className="bg-white/20 rounded px-3 py-1">
                        <div className="text-white text-xs font-semibold">Kids</div>
                        <div className="text-white text-sm font-bold">{session.totalKids}</div>
                      </div>
                    </div>
                    <div className={`text-xs font-medium ${
                      slotsLeft === 0 ? 'text-red-200' :
                      slotsLeft <= 2 ? 'text-yellow-200' :
                      'text-blue-100'
                    }`}>
                      {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} left
                    </div>
                  </div>
                  {/* Capacity bar */}
                  <div className="flex-1 bg-white rounded-full h-2 overflow-hidden min-w-[100px]">
                    <div
                      className={`h-full transition-all ${
                        percentFull >= 100 ? 'bg-red-300' :
                        percentFull >= 80 ? 'bg-yellow-300' :
                        'bg-green-300'
                      }`}
                      style={{ width: `${Math.min(percentFull, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Bookings Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {session.bookings.length === 0 ? (
                    <div className="col-span-full p-8 text-center text-gray-400 text-sm bg-gray-50 rounded-lg">
                      No bookings
                    </div>
                  ) : (
                    session.bookings.map((booking) => {
                        const units = getUnits(booking)
                        // Extract customer name from title (e.g., "Charlotte for Single Child" -> "Charlotte")
                        const customerName = booking.title.split(' for ')[0]

                        const isNoShow = noShowIds.has(booking.id)
                        const isConfirmed = confirmedIds.has(booking.id)
                        const hasDetails = booking.customerEmail || booking.customerPhone
                        const isLoadingDetails = loadingDetails.has(booking.id)

                        return (
                          <div key={booking.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="space-y-2">
                              <div className="font-semibold text-gray-900 flex items-center justify-between">
                                <span>{customerName}</span>
                                {isNoShow && (
                                  <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                                    No Show
                                  </span>
                                )}
                              </div>
                              <div className="text-gray-600 text-xs">Ref: {booking.ref}</div>
                              {booking.legacy?.appointmentTypes && booking.legacy.appointmentTypes.length > 0 && (
                                <div className="text-gray-600 text-xs">
                                  Type: {booking.legacy.appointmentTypes[0].name}
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                                  units === 2 ? 'bg-purple-100 text-purple-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {units} unit{units !== 1 ? 's' : ''}
                                </span>
                              </div>

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

                              {/* Toggle buttons */}
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
  )
}
