"use client"

import { useEffect, useMemo, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import type { RotaEntry, StaffMember } from "../rota/types"

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

export default function AdminPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const isAdminEmail = user?.primaryEmailAddress?.emailAddress === "one@kanane.com"

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [entries, setEntries] = useState<RotaEntry[]>([])
  const [newStaffName, setNewStaffName] = useState("")
  const [newStaffRate, setNewStaffRate] = useState<number>(0)
  const [newRateType, setNewRateType] = useState<"hour" | "day">("hour")
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [editRate, setEditRate] = useState<number>(0)
  const [editRateType, setEditRateType] = useState<"hour" | "day">("hour")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passcode, setPasscode] = useState("")
  const [hasAccess, setHasAccess] = useState(false)
  const [passError, setPassError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"week" | "month">("week")
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [entryEditStaff, setEntryEditStaff] = useState<string>("")
  const [entryEditDate, setEntryEditDate] = useState<string>("")
  const [entryEditStart, setEntryEditStart] = useState<string>("09:00")
  const [entryEditEnd, setEntryEditEnd] = useState<string>("17:00")
  const [entryEditNotes, setEntryEditNotes] = useState<string>("")
  const [entryDeletingId, setEntryDeletingId] = useState<string | null>(null)
  const [entryAddStaff, setEntryAddStaff] = useState<string>("")
  const [entryAddDate, setEntryAddDate] = useState<string>(todayISO())
  const [entryAddStart, setEntryAddStart] = useState<string>("09:00")
  const [entryAddEnd, setEntryAddEnd] = useState<string>("17:00")
  const [entryAddNotes, setEntryAddNotes] = useState<string>("")
  const [entryAdding, setEntryAdding] = useState(false)

  useEffect(() => {
    if (isLoaded && !isAdminEmail) {
      router.replace("/dashboard")
      return
    }
    const loadAll = async () => {
      setLoading(true)
      try {
        await Promise.all([fetchStaff(), fetchEntries()])
      } finally {
        setLoading(false)
      }
    }
    if (isLoaded && isAdminEmail) loadAll()
  }, [isLoaded, isAdminEmail, router])

  if (isLoaded && !isAdminEmail) {
    return null
  }

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/rota/staff", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load staff")
      const data = await res.json()
      const staff = (data.staff || []) as StaffMember[]
      setStaffMembers(staff)
      if (!entryAddStaff && staff.length > 0) setEntryAddStaff(staff[0].name)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff")
    }
  }

  const fetchEntries = async () => {
    try {
      const res = await fetch("/api/rota/entries", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load entries")
      const data = await res.json()
      setEntries(data.entries || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load entries")
    }
  }

  const handlePasscode = () => {
    if (passcode === "zkrdonly") {
      setHasAccess(true)
      setPassError(null)
    } else {
      setPassError("Incorrect code")
    }
  }

  const startEditEntry = (entry: RotaEntry) => {
    setEditingEntryId(entry.id)
    setEntryEditStaff(entry.staff)
    setEntryEditDate(entry.date)
    setEntryEditStart(entry.startTime)
    setEntryEditEnd(entry.endTime)
    setEntryEditNotes(entry.notes || "")
  }

  const cancelEditEntry = () => {
    setEditingEntryId(null)
    setEntryEditStaff("")
    setEntryEditDate("")
    setEntryEditStart("09:00")
    setEntryEditEnd("17:00")
    setEntryEditNotes("")
  }

  const saveEntryEdit = async () => {
    if (!editingEntryId) return
    try {
      setError(null)
      const res = await fetch("/api/rota/entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingEntryId,
          staff: entryEditStaff,
          date: entryEditDate,
          startTime: entryEditStart,
          endTime: entryEditEnd,
          notes: entryEditNotes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update entry")
      }
      await fetchEntries()
      cancelEditEntry()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update entry")
    }
  }

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this shift?")) return
    try {
      setError(null)
      setEntryDeletingId(id)
      const res = await fetch(`/api/rota/entries?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete entry")
      }
      await fetchEntries()
      if (editingEntryId === id) cancelEditEntry()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete entry")
    } finally {
      setEntryDeletingId(null)
    }
  }

  const addEntry = async () => {
    const staff = entryAddStaff.trim()
    if (!staff) {
      alert("Select a staff member")
      return
    }
    const date = entryAddDate.trim()
    if (!date) {
      alert("Select a date")
      return
    }
    const diffMins = minutesDiff(entryAddStart, entryAddEnd)
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
      setEntryAdding(true)
      setError(null)
      const res = await fetch("/api/rota/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff,
          date,
          startTime: entryAddStart,
          endTime: entryAddEnd,
          notes: entryAddNotes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to add shift")
      }
      await fetchEntries()
      setEntryAddDate(todayISO())
      setEntryAddStart("09:00")
      setEntryAddEnd("17:00")
      setEntryAddNotes("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add shift")
    } finally {
      setEntryAdding(false)
    }
  }

  const addStaffMember = () => {
    const name = newStaffName.trim()
    if (!name) return
    if (staffMembers.some(m => m.name === name)) {
      alert("Staff member already exists")
      return
    }
    const rate = Number.isFinite(newStaffRate) ? newStaffRate : 0
    saveStaff({ name, rate, rateType: newRateType })
  }

  const startEdit = (name: string) => {
    setEditingName(name)
    setEditValue(name)
    const member = staffMembers.find(m => m.name === name)
    setEditRate(member?.rate ?? 0)
    setEditRateType(member?.rateType === "day" ? "day" : "hour")
  }

  const saveEdit = (name: string) => {
    const next = editValue.trim()
    if (!next) return
    if (next !== name && staffMembers.some(m => m.name === next)) {
      alert("Name already exists")
      return
    }
    const rate = Number.isFinite(editRate) ? editRate : 0
    updateStaff(name, next, rate, editRateType)
  }

  const deleteStaff = (name: string) => {
    if (!confirm(`Remove ${name} and their logged shifts?`)) return
    removeStaff(name)
  }

  const currentWeekTotal = useMemo(() => {
    const now = new Date()
    const start = new Date(now)
    const day = start.getDay()
    const diff = (day + 6) % 7 // Monday start
    start.setDate(start.getDate() - diff)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    return entries
      .filter(e => {
        const d = new Date(e.date + "T00:00:00")
        return d >= start && d < end
      })
      .reduce((sum, e) => sum + e.hours, 0)
  }, [entries])

  const currentMonthTotal = useMemo(() => {
    const now = new Date()
    const m = now.getMonth()
    const y = now.getFullYear()
    return entries
      .filter(e => {
        const d = new Date(e.date + "T00:00:00")
        return d.getMonth() === m && d.getFullYear() === y
      })
      .reduce((sum, e) => sum + e.hours, 0)
  }, [entries])

  const payForEntries = (targetEntries: RotaEntry[]) =>
    targetEntries.reduce((sum, e) => {
      const member = staffMembers.find(m => m.name === e.staff)
      const rate = member?.rate ?? 0
      const rateType = member?.rateType === "day" ? "day" : "hour"
      if (rateType === "day") {
        const portion = e.hours >= 7 ? 1 : 0.5
        return sum + portion * rate
      }
      return sum + e.hours * rate
    }, 0)

  const currentWeekPay = useMemo(() => {
    const now = new Date()
    const start = new Date(now)
    const day = start.getDay()
    const diff = (day + 6) % 7 // Monday start
    start.setDate(start.getDate() - diff)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    const weekEntries = entries.filter(e => {
      const d = new Date(e.date + "T00:00:00")
      return d >= start && d < end
    })
    return payForEntries(weekEntries)
  }, [entries, staffMembers])

  const saveStaff = async ({ name, rate, rateType }: { name: string; rate: number; rateType: "hour" | "day" }) => {
    try {
      setError(null)
      const res = await fetch("/api/rota/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rate, rateType }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to add staff")
      }
      const data = await res.json()
      setStaffMembers(data.staff || [])
      setNewStaffName("")
      setNewStaffRate(0)
      setNewRateType("hour")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add staff")
    }
  }

  const updateStaff = async (originalName: string, name: string, rate: number, rateType: "hour" | "day") => {
    try {
      setError(null)
      const res = await fetch("/api/rota/staff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalName, name, rate, rateType }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update staff")
      }
      const data = await res.json()
      setStaffMembers(data.staff || [])
      await fetchEntries()
      setEditingName(null)
      setEditValue("")
      setEditRate(0)
      setEditRateType("hour")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update staff")
    }
  }

  const removeStaff = async (name: string) => {
    try {
      setError(null)
      const res = await fetch(`/api/rota/staff?name=${encodeURIComponent(name)}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete staff")
      }
      const data = await res.json()
      setStaffMembers(data.staff || [])
      await fetchEntries()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete staff")
    }
  }

  const currentMonthPay = useMemo(() => {
    const now = new Date()
    const m = now.getMonth()
    const y = now.getFullYear()
    const monthEntries = entries.filter(e => {
      const d = new Date(e.date + "T00:00:00")
      return d.getMonth() === m && d.getFullYear() === y
    })
    return payForEntries(monthEntries)
  }, [entries, staffMembers])

  const filteredEntries = useMemo(() => {
    const now = new Date()
    if (viewMode === "month") {
      const m = now.getMonth()
      const y = now.getFullYear()
      return entries.filter(e => {
        const d = new Date(e.date + "T00:00:00")
        return d.getMonth() === m && d.getFullYear() === y
      })
    }
    const start = new Date(now)
    const day = start.getDay()
    const diff = (day + 6) % 7
    start.setDate(start.getDate() - diff)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    return entries.filter(e => {
      const d = new Date(e.date + "T00:00:00")
      return d >= start && d < end
    })
  }, [entries, viewMode])

  const entriesByDate = useMemo(() => {
    return filteredEntries.reduce<Record<string, RotaEntry[]>>((acc, entry) => {
      if (!acc[entry.date]) acc[entry.date] = []
      acc[entry.date].push(entry)
      return acc
    }, {})
  }, [filteredEntries])

  const getWeekRange = () => {
    const now = new Date()
    const start = new Date(now)
    const day = start.getDay()
    const diff = (day + 6) % 7
    start.setDate(start.getDate() - diff)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    return { start, end }
  }

  const getMonthRange = () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return { start, end }
  }

  const calcStaffPayForEntry = (member: StaffMember, entry: RotaEntry) => {
    const rateType = member.rateType === "day" ? "day" : "hour"
    if (rateType === "day") {
      const portion = entry.hours >= 7 ? 1 : 0.5
      return portion * member.rate
    }
    return entry.hours * member.rate
  }

  const entryAddHours = useMemo(() => {
    const diffMins = minutesDiff(entryAddStart, entryAddEnd)
    if (diffMins <= 0) return 0
    return Math.round((diffMins / 60) * 4) / 4
  }, [entryAddStart, entryAddEnd])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#557355]">Admin</p>
          <h1 className="text-3xl font-bold text-gray-900">Staff & totals</h1>
          <p className="text-sm text-gray-600">Add/edit/delete staff and review weekly/monthly hour totals.</p>
        </div>
        {loading && <p className="text-xs text-gray-500">Loading…</p>}
      </div>

      {!hasAccess ? (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-6 max-w-xl">
          <p className="text-sm font-semibold text-gray-900 mb-2">Restricted</p>
          <p className="text-sm text-gray-600 mb-4">Enter the admin passcode to continue.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="password"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              placeholder="Passcode"
              className="flex-1 rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355]"
            />
            <button
              onClick={handlePasscode}
              className="inline-flex items-center justify-center rounded-lg bg-[#557355] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#4a6349] transition-colors"
            >
              Unlock
            </button>
          </div>
          {passError && <p className="mt-2 text-xs text-red-600">{passError}</p>}
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-6 space-y-4">
              <p className="text-sm font-semibold text-gray-900">Staff directory</p>
              <div className="space-y-3">
                {staffMembers.length === 0 && <p className="text-sm text-gray-500">No staff yet.</p>}
                {staffMembers.map(member => (
                  <div key={member.name} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 ring-1 ring-gray-200">
                    {editingName === member.name ? (
                      <>
                        <input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="flex-1 rounded-md border-0 bg-white px-2 py-1 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-[#557355]"
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editRate}
                          onChange={e => setEditRate(Number(e.target.value))}
                          className="w-28 rounded-md border-0 bg-white px-2 py-1 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-[#557355]"
                          placeholder="Rate £"
                        />
                        <select
                          value={editRateType}
                          onChange={e => setEditRateType(e.target.value === "day" ? "day" : "hour")}
                          className="w-24 rounded-md border-0 bg-white px-2 py-1 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-[#557355]"
                        >
                          <option value="hour">Per hour</option>
                          <option value="day">Per day</option>
                        </select>
                        <button
                          onClick={() => saveEdit(member.name)}
                          className="text-xs font-semibold text-[#557355] hover:text-[#4a6349]"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingName(null)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500">
                            £{member.rate.toFixed(2)}/{member.rateType === "day" ? "day" : "hr"}
                          </p>
                        </div>
                        <button
                          onClick={() => startEdit(member.name)}
                          className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteStaff(member.name)}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <input
                  type="text"
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  placeholder="Add staff name"
                  className="flex-1 rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355]"
                />
              <input
                type="number"
                min={0}
                step="0.01"
                value={newStaffRate}
                onChange={e => setNewStaffRate(Number(e.target.value))}
                placeholder="Rate £"
                className="w-32 rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355]"
              />
              <select
                value={newRateType}
                onChange={e => setNewRateType(e.target.value === "day" ? "day" : "hour")}
                className="w-28 rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355]"
              >
                <option value="hour">Per hour</option>
                <option value="day">Per day</option>
              </select>
              <button
                onClick={addStaffMember}
                className="inline-flex items-center justify-center rounded-lg bg-[#557355] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#4a6349] transition-colors"
              >
                Add staff
                </button>
              </div>
              <p className="text-xs text-gray-500">Lock this down later to admin only.</p>
            </div>

            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-6 space-y-4">
              <p className="text-sm font-semibold text-gray-900">Totals</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-white border border-blue-100 p-4">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">This week</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{currentWeekTotal.toFixed(2)} hrs</p>
                  <p className="text-xs text-gray-500">Payment due: £{currentWeekPay.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Mon - Sun</p>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-amber-50 to-white border border-amber-100 p-4">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">This month</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{currentMonthTotal.toFixed(2)} hrs</p>
                  <p className="text-xs text-gray-500">Payment due: £{currentMonthPay.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Calendar month</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Entries</p>
                <p className="text-sm text-gray-800">{entries.length} shifts logged</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-6 space-y-3">
              <p className="text-sm font-semibold text-gray-900">Payments by staff</p>
              <div className="space-y-2">
                {staffMembers.length === 0 && <p className="text-sm text-gray-500">No staff yet.</p>}
                {staffMembers.map(member => {
                  const { start: weekStart, end: weekEnd } = getWeekRange()
                  const { start: monthStart, end: monthEnd } = getMonthRange()

                  const staffEntries = entries.filter(e => e.staff === member.name)
                  const totalHours = entries
                    .filter(e => e.staff === member.name)
                    .reduce((sum, e) => sum + e.hours, 0)
                  const rateType = member.rateType === "day" ? "day" : "hour"
                  const totalPay = staffEntries.reduce((sum, e) => sum + calcStaffPayForEntry(member, e), 0)

                  const weekEntries = staffEntries.filter(e => {
                    const d = new Date(e.date + "T00:00:00")
                    return d >= weekStart && d < weekEnd
                  })
                  const weekHours = weekEntries.reduce((sum, e) => sum + e.hours, 0)
                  const weekPay = weekEntries.reduce((sum, e) => sum + calcStaffPayForEntry(member, e), 0)

                  const monthEntries = staffEntries.filter(e => {
                    const d = new Date(e.date + "T00:00:00")
                    return d >= monthStart && d < monthEnd
                  })
                  const monthHours = monthEntries.reduce((sum, e) => sum + e.hours, 0)
                  const monthPay = monthEntries.reduce((sum, e) => sum + calcStaffPayForEntry(member, e), 0)
                  return (
                    <div key={member.name} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 ring-1 ring-gray-200">
                      <div>
                        <p className="text-sm text-gray-900">{member.name}</p>
                        <p className="text-xs text-gray-500">
                          {totalHours.toFixed(2)} hrs @ £{member.rate.toFixed(2)}/{rateType === "day" ? "day" : "hr"}
                        </p>
                        <p className="text-xs text-gray-500">
                          Week: {weekHours.toFixed(2)} hrs • £{weekPay.toFixed(2)} &nbsp;|&nbsp; Month: {monthHours.toFixed(2)} hrs • £{monthPay.toFixed(2)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">£{totalPay.toFixed(2)}</p>
                    </div>
                  )
                })}
              </div>
            </div>

	            <div className="lg:col-span-2 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-6 space-y-4">
	              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
	                <div>
	                  <p className="text-sm font-semibold text-gray-900">Shift breakdown</p>
	                  <p className="text-xs text-gray-500">Edit any day from here (week/month view).</p>
	                </div>
                <div className="inline-flex rounded-lg bg-gray-50 ring-1 ring-gray-200 p-1">
                  <button
                    onClick={() => setViewMode("week")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      viewMode === "week" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setViewMode("month")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      viewMode === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Month
                  </button>
	                </div>
	              </div>

                <div className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-200">
                  <p className="text-sm font-semibold text-gray-900 mb-3">Add shift (admin)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-medium text-gray-600">Staff</label>
                      <select
                        value={entryAddStaff}
                        onChange={e => setEntryAddStaff(e.target.value)}
                        className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355]"
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
                        value={entryAddDate}
                        onChange={e => setEntryAddDate(e.target.value)}
                        className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Start</label>
                      <select
                        value={entryAddStart}
                        onChange={e => setEntryAddStart(e.target.value)}
                        className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355]"
                      >
                        {timeOptions.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Finish</label>
                      <select
                        value={entryAddEnd}
                        onChange={e => setEntryAddEnd(e.target.value)}
                        className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355]"
                      >
                        {timeOptions.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1 sm:col-span-5">
                      <label className="text-xs font-medium text-gray-600">Notes (optional)</label>
                      <input
                        value={entryAddNotes}
                        onChange={e => setEntryAddNotes(e.target.value)}
                        className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355]"
                        placeholder="e.g. cover / holiday / training"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-gray-600">
                      Hours calculated: <span className="font-semibold text-gray-900">{entryAddHours.toFixed(2)} hrs</span>
                    </p>
                    <button
                      onClick={addEntry}
                      disabled={entryAdding || staffMembers.length === 0}
                      className="inline-flex items-center justify-center rounded-lg bg-[#557355] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#4a6349] disabled:opacity-50 transition-colors"
                    >
                      {entryAdding ? "Adding…" : "Add shift"}
                    </button>
                  </div>
                </div>
	
	              {Object.keys(entriesByDate).length === 0 ? (
	                <p className="text-sm text-gray-500">No shifts found for this {viewMode}.</p>
	              ) : (
                <div className="space-y-4">
                  {Object.keys(entriesByDate)
                    .sort((a, b) => (a < b ? 1 : -1))
                    .map(date => {
                      const dayEntries = entriesByDate[date].slice().sort((a, b) => (a.staff > b.staff ? 1 : -1))
                      const dayTotal = dayEntries.reduce((sum, e) => sum + e.hours, 0)
                      return (
                        <div key={date} className="rounded-xl border border-gray-200 overflow-hidden">
                          <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
                            <p className="text-sm font-semibold text-gray-900">{date}</p>
                            <p className="text-xs text-gray-600">{dayTotal.toFixed(2)} hrs total</p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                              <thead className="bg-white">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Staff</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Time</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Hours</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Notes</th>
                                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {dayEntries.map(entry => {
                                  const isEditing = editingEntryId === entry.id
                                  return (
                                    <tr key={entry.id}>
                                      <td className="px-4 py-2 text-gray-900">
                                        {isEditing ? (
                                          <select
                                            value={entryEditStaff}
                                            onChange={e => setEntryEditStaff(e.target.value)}
                                            className="rounded-md border border-gray-200 px-2 py-1 text-sm"
                                          >
                                            {staffMembers.map(s => (
                                              <option key={s.name} value={s.name}>{s.name}</option>
                                            ))}
                                          </select>
                                        ) : (
                                          entry.staff
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-gray-900">
                                        {isEditing ? (
                                          <input
                                            type="date"
                                            value={entryEditDate}
                                            onChange={e => setEntryEditDate(e.target.value)}
                                            className="rounded-md border border-gray-200 px-2 py-1 text-sm"
                                          />
                                        ) : (
                                          entry.date
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-gray-900">
                                        {isEditing ? (
                                          <div className="flex gap-2">
                                            <select
                                              value={entryEditStart}
                                              onChange={e => setEntryEditStart(e.target.value)}
                                              className="w-28 rounded-md border border-gray-200 px-2 py-1 text-sm"
                                            >
                                              {timeOptions.map(t => (
                                                <option key={t} value={t}>{t}</option>
                                              ))}
                                            </select>
                                            <select
                                              value={entryEditEnd}
                                              onChange={e => setEntryEditEnd(e.target.value)}
                                              className="w-28 rounded-md border border-gray-200 px-2 py-1 text-sm"
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
                                      <td className="px-4 py-2 text-gray-900">{entry.hours.toFixed(2)}</td>
                                      <td className="px-4 py-2 text-gray-600">
                                        {isEditing ? (
                                          <input
                                            type="text"
                                            value={entryEditNotes}
                                            onChange={e => setEntryEditNotes(e.target.value)}
                                            className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                                          />
                                        ) : (
                                          entry.notes || "—"
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-right">
                                        {isEditing ? (
                                          <div className="inline-flex gap-2">
                                            <button
                                              onClick={saveEntryEdit}
                                              className="text-xs font-semibold text-[#557355] hover:text-[#4a6349]"
                                            >
                                              Save
                                            </button>
                                            <button
                                              onClick={cancelEditEntry}
                                              className="text-xs text-gray-500 hover:text-gray-700"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              onClick={() => deleteEntry(entry.id)}
                                              disabled={entryDeletingId === entry.id}
                                              className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                                            >
                                              {entryDeletingId === entry.id ? "Deleting…" : "Delete"}
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="inline-flex gap-2">
                                            <button
                                              onClick={() => startEditEntry(entry)}
                                              className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              onClick={() => deleteEntry(entry.id)}
                                              disabled={entryDeletingId === entry.id}
                                              className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                                            >
                                              {entryDeletingId === entry.id ? "Deleting…" : "Delete"}
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
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
    </div>
  )
}
