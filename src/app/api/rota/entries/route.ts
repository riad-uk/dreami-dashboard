import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { kv } from "@vercel/kv"

import type { RotaEntry } from "@/app/dashboard/rota/types"

const KV_KEY = "rota-entries"

const todayISO = () => new Date().toISOString().slice(0, 10)

const loadEntries = async (): Promise<RotaEntry[]> => {
  try {
    const data = await kv.get<RotaEntry[]>(KV_KEY)
    if (!Array.isArray(data)) return []
    return data
  } catch (e) {
    console.error("Error reading rota entries:", e)
    return []
  }
}

const saveEntries = async (entries: RotaEntry[]) => {
  try {
    await kv.set(KV_KEY, entries)
  } catch (e) {
    console.error("Error writing rota entries:", e)
  }
}

const minutesDiff = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  return endMins - startMins
}

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const date = request.nextUrl.searchParams.get("date")
  const entries = await loadEntries()

  if (date) {
    return NextResponse.json({ entries: entries.filter(e => e.date === date) })
  }

  return NextResponse.json({ entries })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { staff, date, startTime, endTime, notes } = body as Partial<RotaEntry>

  if (!staff || !startTime || !endTime) {
    return NextResponse.json({ error: "staff, startTime, endTime required" }, { status: 400 })
  }

  const entryDate = date || todayISO()
  const diffMins = minutesDiff(startTime, endTime)
  if (diffMins <= 0) {
    return NextResponse.json({ error: "Finish time must be after start time" }, { status: 400 })
  }
  const hours = Math.round((diffMins / 60) * 4) / 4
  if (hours > 24) {
    return NextResponse.json({ error: "Shift cannot exceed 24 hours" }, { status: 400 })
  }

  const newEntry: RotaEntry = {
    id: `rota-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    staff,
    date: entryDate,
    startTime,
    endTime,
    hours,
    notes: notes?.toString().trim() || undefined,
  }

  const entries = await loadEntries()
  const hasExisting = entries.some(e => e.staff === staff && e.date === entryDate)
  if (hasExisting) {
    return NextResponse.json({ error: "Staff already has a shift for this date" }, { status: 409 })
  }
  entries.push(newEntry)
  await saveEntries(entries)

  const filtered = request.nextUrl.searchParams.get("date")
    ? entries.filter(e => e.date === entryDate)
    : entries

  return NextResponse.json({ entries: filtered, entry: newEntry })
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { id, startTime, endTime, notes, date, staff } = body as Partial<RotaEntry>

  if (!id || !startTime || !endTime) {
    return NextResponse.json({ error: "id, startTime, endTime required" }, { status: 400 })
  }

  const diffMins = minutesDiff(startTime, endTime)
  if (diffMins <= 0) {
    return NextResponse.json({ error: "Finish time must be after start time" }, { status: 400 })
  }
  const hours = Math.round((diffMins / 60) * 4) / 4
  if (hours > 24) {
    return NextResponse.json({ error: "Shift cannot exceed 24 hours" }, { status: 400 })
  }

  const entries = await loadEntries()
  const idx = entries.findIndex(e => e.id === id)
  if (idx === -1) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 })
  }

  const existing = entries[idx]
  const nextStaff = (staff || existing.staff).trim()
  const nextDate = date || existing.date

  if (!nextStaff || !nextDate) {
    return NextResponse.json({ error: "staff and date required" }, { status: 400 })
  }

  // Enforce one shift per staff per day (excluding the entry being updated)
  const wouldDuplicate = entries.some(e => e.id !== id && e.staff === nextStaff && e.date === nextDate)
  if (wouldDuplicate) {
    return NextResponse.json({ error: "Staff already has a shift for this date" }, { status: 409 })
  }

  const updated: RotaEntry = {
    ...existing,
    staff: nextStaff,
    startTime,
    endTime,
    hours,
    notes: notes?.toString().trim() || undefined,
    date: nextDate,
  }

  entries[idx] = updated
  await saveEntries(entries)

  const targetDate = nextDate
  const filtered = request.nextUrl.searchParams.get("date")
    ? entries.filter(e => e.date === targetDate)
    : entries

  return NextResponse.json({ entries: filtered, entry: updated })
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = request.nextUrl.searchParams.get("id") || ""
  const date = request.nextUrl.searchParams.get("date") || ""
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 })
  }

  const entries = await loadEntries()
  const filteredEntries = entries.filter(e => e.id !== id)
  await saveEntries(filteredEntries)

  const responseEntries = date ? filteredEntries.filter(e => e.date === date) : filteredEntries
  return NextResponse.json({ entries: responseEntries })
}
