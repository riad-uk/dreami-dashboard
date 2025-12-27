"use client"

import { useEffect, useMemo, useState } from "react"
import type { RotaEntry, StaffMember } from "./types"

const todayISO = () => new Date().toISOString().slice(0, 10)

const defaultStaff: StaffMember[] = [
  { name: "Alice", rate: 0 },
  { name: "Ben", rate: 0 },
  { name: "Charlie", rate: 0 },
]

const minutesDiff = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  return endMins - startMins
}

const timeOptions = Array.from({ length: (20 - 8) * 4 + 1 }, (_, i) => {
  const mins = (8 * 60) + i * 15
  const hh = String(Math.floor(mins / 60)).padStart(2, "0")
  const mm = String(mins % 60).padStart(2, "0")
  return `${hh}:${mm}`
})

export default function RotaPage() {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [entries, setEntries] = useState<RotaEntry[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string>("")
  const [entryDate] = useState<string>(todayISO())
  const [startTime, setStartTime] = useState<string>("09:00")
  const [endTime, setEndTime] = useState<string>("17:00")
  const [notes, setNotes] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStart, setEditStart] = useState<string>("09:00")
  const [editEnd, setEditEnd] = useState<string>("17:00")
  const [editNotes, setEditNotes] = useState<string>("")
  const [deleting, setDeleting] = useState(false)

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/rota/staff", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load staff")
      const data = await res.json()
      const staff: StaffMember[] = data.staff || []
      setStaffMembers(staff)
      if (!selectedStaff && staff.length > 0) {
        setSelectedStaff(staff[0].name)
      } else if (selectedStaff && !staff.some(s => s.name === selectedStaff)) {
        setSelectedStaff(staff[0]?.name || "")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff")
    }
  }

  const fetchEntries = async () => {
    try {
      const res = await fetch(`/api/rota/entries?date=${entryDate}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load entries")
      const data = await res.json()
      setEntries(data.entries || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load entries")
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchStaff(), fetchEntries()]).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addEntry = async () => {
    if (!selectedStaff) {
      alert("Select a staff member")
      return
    }
    const diffMins = minutesDiff(startTime, endTime)
    if (diffMins <= 0) {
      alert("Finish time must be after start time")
      return
    }
    const hours = Math.round((diffMins / 60) * 4) / 4 // 15-min increments
    if (hours > 24) {
      alert("Shift cannot exceed 24 hours")
      return
    }
    try {
      setError(null)
      const res = await fetch("/api/rota/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff: selectedStaff,
          date: entryDate,
          startTime,
          endTime,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save entry")
      }
      const data = await res.json()
      setEntries(data.entries || [])
      setStartTime("09:00")
      setEndTime("17:00")
      setNotes("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save entry")
    }
  }

  const startEditing = (entry: RotaEntry) => {
    setEditingId(entry.id)
    setEditStart(entry.startTime)
    setEditEnd(entry.endTime)
    setEditNotes(entry.notes || "")
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditStart("09:00")
    setEditEnd("17:00")
    setEditNotes("")
  }

  const saveEdit = async () => {
    if (!editingId) return
    const diffMins = minutesDiff(editStart, editEnd)
    if (diffMins <= 0) {
      alert("Finish time must be after start time")
      return
    }
    const hours = Math.round((diffMins / 60) * 4) / 4
    if (hours > 24) {
      alert("Shift cannot exceed 24 hours")
      return
    }
    try {
      setError(null)
      const res = await fetch("/api/rota/entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          startTime: editStart,
          endTime: editEnd,
          notes: editNotes.trim() || undefined,
          date: entryDate,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update entry")
      }
      const data = await res.json()
      setEntries(data.entries || [])
      cancelEditing()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update entry")
    }
  }

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this shift?")) return
    try {
      setDeleting(true)
      const res = await fetch(`/api/rota/entries?id=${encodeURIComponent(id)}&date=${entryDate}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete entry")
      }
      const data = await res.json()
      setEntries(data.entries || [])
      cancelEditing()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete entry")
    } finally {
      setDeleting(false)
    }
  }

  const todayEntries = useMemo(
    () => entries.filter(e => e.date === entryDate),
    [entries, entryDate]
  )

  const totalsByDate = useMemo(() => {
    return entries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.date] = (acc[entry.date] || 0) + entry.hours
      return acc
    }, {})
  }, [entries])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#557355]">Rota</p>
          <h1 className="text-3xl font-bold text-gray-900">Shift planning</h1>
          <p className="text-sm text-gray-600">Log your shift in 30-minute increments. Staff list is managed in Admin.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Entry form */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Add shift</p>
              <p className="text-xs text-gray-500">0.5 hr to 24 hr increments</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Staff</label>
              <select
                value={selectedStaff}
                onChange={e => setSelectedStaff(e.target.value)}
                className="w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355]"
              >
                {staffMembers.length === 0 && <option value="">No staff</option>}
                {staffMembers.map(member => (
                  <option key={member.name} value={member.name}>{member.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Date</label>
              <input
                type="date"
                value={entryDate}
                disabled
                className="w-full rounded-lg border-0 bg-gray-100 px-3 py-2 text-sm text-gray-700 ring-1 ring-inset ring-gray-200"
              />
              <p className="text-[11px] text-gray-500">Entries are locked to today.</p>
            </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Start time</label>
                <select
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355]"
                >
                  {timeOptions.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Finish time</label>
                <select
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355]"
                >
                  {timeOptions.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-600">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Morning cover"
                className="w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355]"
              />
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Hours calculated: <span className="font-semibold text-gray-900">{(Math.round((minutesDiff(startTime, endTime) / 60) * 4) / 4 > 0 ? Math.round((minutesDiff(startTime, endTime) / 60) * 4) / 4 : 0).toFixed(2)} hrs</span>
          </div>
          <button
            onClick={addEntry}
            className="inline-flex items-center justify-center rounded-lg bg-[#557355] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#4a6349] transition-colors"
          >
            Add shift
          </button>
        </div>

        {/* Day totals */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Totals by day</p>
            <p className="text-xs text-gray-500">Auto-calculated</p>
          </div>
          {Object.keys(totalsByDate).length === 0 ? (
            <p className="text-sm text-gray-500">No shifts logged yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(totalsByDate)
                .sort(([a], [b]) => (a < b ? 1 : -1))
                .map(([date, total]) => (
                  <div key={date} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-sm font-medium text-gray-800">{date}</span>
                    <span className="text-sm font-semibold text-gray-900">{total.toFixed(1)} hrs</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

        {/* Entries list */}
        <div className="mt-8 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-900">Logged shifts (today)</p>
            <p className="text-xs text-gray-500">{todayEntries.length} total</p>
          </div>
          {todayEntries.length === 0 ? (
            <p className="text-sm text-gray-500">No shifts logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Staff</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Hours</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Time</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {todayEntries.map(entry => {
                    const isEditing = editingId === entry.id
                    return (
                      <tr key={entry.id}>
                        <td className="px-3 py-2 text-gray-800">{entry.date}</td>
                        <td className="px-3 py-2 text-gray-800">{entry.staff}</td>
                        <td className="px-3 py-2 text-gray-800">
                          {isEditing ? (
                            <span className="text-gray-700">
                              {(
                                Math.round((minutesDiff(editStart, editEnd) / 60) * 4) / 4 > 0
                                  ? Math.round((minutesDiff(editStart, editEnd) / 60) * 4) / 4
                                  : 0
                              ).toFixed(2)} hrs
                            </span>
                          ) : (
                            `${entry.hours.toFixed(2)} hrs`
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-800">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <select
                                value={editStart}
                                onChange={e => setEditStart(e.target.value)}
                                className="w-28 rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-900"
                              >
                                {timeOptions.map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                              <select
                                value={editEnd}
                                onChange={e => setEditEnd(e.target.value)}
                                className="w-28 rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-900"
                              >
                                {timeOptions.map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            `${entry.startTime} - ${entry.endTime}`
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editNotes}
                              onChange={e => setEditNotes(e.target.value)}
                              className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-900"
                              placeholder="Notes"
                            />
                          ) : (
                            entry.notes || "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isEditing ? (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={saveEdit}
                                className="text-xs font-semibold text-[#557355] hover:text-[#4a6349]"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                disabled={deleting}
                                className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                {deleting ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => startEditing(entry)}
                                className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                disabled={deleting}
                                className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                {deleting ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
