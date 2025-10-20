"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import type { YCBMBooking } from "@/types/ycbm"

// Calculate units based on appointment type
const getUnits = (booking: YCBMBooking): number => {
  const appointmentType = booking.legacy?.appointmentTypes?.[0]?.name?.toLowerCase() || ""

  if (appointmentType.includes("sibling") || appointmentType.includes("child + sibling")) {
    return 2
  }
  return 1
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
      setBookings(data.bookings || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  // Load no-show status from localStorage
  useEffect(() => {
    const storedNoShows = localStorage.getItem('ycbm-no-shows')
    if (storedNoShows) {
      setNoShowIds(new Set(JSON.parse(storedNoShows)))
    }

    const storedConfirmed = localStorage.getItem('ycbm-confirmed')
    if (storedConfirmed) {
      setConfirmedIds(new Set(JSON.parse(storedConfirmed)))
    }
  }, [])

  // Save no-show status to localStorage
  useEffect(() => {
    localStorage.setItem('ycbm-no-shows', JSON.stringify(Array.from(noShowIds)))
  }, [noShowIds])

  // Save confirmed status to localStorage
  useEffect(() => {
    localStorage.setItem('ycbm-confirmed', JSON.stringify(Array.from(confirmedIds)))
  }, [confirmedIds])

  useEffect(() => {
    fetchBookings(selectedDate)
  }, [selectedDate])

  // Toggle no-show status
  const toggleNoShow = (bookingId: string) => {
    setNoShowIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId)
      } else {
        newSet.add(bookingId)
      }
      return newSet
    })
  }

  // Toggle confirmed status
  const toggleConfirmed = (bookingId: string) => {
    setConfirmedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId)
      } else {
        newSet.add(bookingId)
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
        format(new Date(booking.starts), 'yyyy-MM-dd'),
        format(new Date(booking.starts), 'HH:mm'),
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
    setSelectedDate(getDefaultDate())
  }

  // Define all possible session times
  const allSessionTimes = ["09:30", "11:30", "13:30", "15:30"]

  // Filter and group bookings by session time
  const bookingsByTime = bookings.reduce((acc: Record<string, YCBMBooking[]>, booking) => {
    if (booking.cancelled) return acc // Skip cancelled bookings

    // Check if booking is on the selected date
    const bookingDate = format(new Date(booking.starts), "yyyy-MM-dd")
    if (bookingDate !== selectedDate) return acc // Skip bookings from other dates

    // Filter by no-show if enabled (use local state)
    if (showNoShowOnly && !noShowIds.has(booking.id)) return acc

    // Extract just the time portion (HH:mm) from the starts field
    const timeOnly = format(new Date(booking.starts), "HH:mm")

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

    return {
      time,
      bookings: sessionBookings,
      totalUnits,
      capacity: 11
    }
  })

  console.log(`Grouped into ${groupedSessions.length} sessions:`, groupedSessions.map(s => `${s.time}: ${s.bookings.length} bookings, ${s.totalUnits} units`))

  // Calculate no-show statistics (use local state)
  const totalBookings = bookings.filter(b => !b.cancelled).length
  const noShowCount = bookings.filter(b => !b.cancelled && noShowIds.has(b.id)).length

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">YCBM Bookings</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={exportNoShowsToCSV}
            disabled={noShowCount === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleToday}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Today
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-sm text-blue-800">
            <strong>{format(new Date(selectedDate), "PPPP")}</strong>
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-sm text-green-800">
            Total Bookings: <strong>{totalBookings}</strong>
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">
            No-Shows: <strong>{noShowCount}</strong>
            {noShowCount > 0 && ` (${((noShowCount / totalBookings) * 100).toFixed(1)}%)`}
          </p>
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {groupedSessions.map((session, idx) => {
            const slotsLeft = session.capacity - session.totalUnits
            const percentFull = (session.totalUnits / session.capacity) * 100

            return (
              <div key={idx} className="bg-white shadow rounded-lg overflow-hidden flex flex-col">
                {/* Session Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3">
                  <h3 className="text-lg font-bold text-white text-center">
                    {session.time}
                  </h3>
                  <div className="text-center mt-1">
                    <div className="text-white text-xl font-bold">
                      {session.totalUnits}/{session.capacity}
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
                  <div className="mt-2 bg-blue-400 rounded-full h-1.5 overflow-hidden">
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

                {/* Bookings List */}
                <div className="flex-1 overflow-y-auto max-h-[600px]">
                  {session.bookings.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm">
                      No bookings
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {session.bookings.map((booking) => {
                        const units = getUnits(booking)
                        // Extract customer name from title (e.g., "Charlotte for Single Child" -> "Charlotte")
                        const customerName = booking.title.split(' for ')[0]

                        const isNoShow = noShowIds.has(booking.id)
                        const isConfirmed = confirmedIds.has(booking.id)
                        const hasDetails = booking.customerEmail || booking.customerPhone
                        const isLoadingDetails = loadingDetails.has(booking.id)

                        return (
                          <div key={booking.id} className="p-3 hover:bg-gray-50 text-sm">
                            <div className="space-y-1">
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
                                  onClick={() => toggleNoShow(booking.id)}
                                  className={`flex-1 text-xs py-1 px-2 rounded ${
                                    isNoShow
                                      ? 'bg-red-100 text-red-700 border border-red-300'
                                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                                  }`}
                                >
                                  {isNoShow ? '✓ No Show' : 'No Show'}
                                </button>
                                <button
                                  onClick={() => toggleConfirmed(booking.id)}
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
                      })}
                    </div>
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
