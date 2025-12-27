import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { kv } from "@vercel/kv"

import type { RotaEntry, StaffMember } from "@/app/dashboard/rota/types"

const STAFF_KEY = "rota-staff"
const ENTRIES_KEY = "rota-entries"

const loadStaff = async (fallback: StaffMember[] = []): Promise<StaffMember[]> => {
  try {
    const data = await kv.get<StaffMember[] | string[]>(STAFF_KEY)
    if (!data) return fallback
    if (Array.isArray(data) && typeof data[0] === "string") {
      return (data as string[]).map(name => ({ name, rate: 0, rateType: "hour" }))
    }
    if (Array.isArray(data)) return data as StaffMember[]
    return fallback
  } catch (e) {
    console.error("Error reading staff:", e)
    return fallback
  }
}

const saveStaff = async (staff: StaffMember[]) => {
  try {
    await kv.set(STAFF_KEY, staff)
  } catch (e) {
    console.error("Error writing staff:", e)
  }
}

const loadEntries = async (): Promise<RotaEntry[]> => {
  try {
    const data = await kv.get<RotaEntry[]>(ENTRIES_KEY)
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.error("Error reading entries:", e)
    return []
  }
}

const saveEntries = async (entries: RotaEntry[]) => {
  try {
    await kv.set(ENTRIES_KEY, entries)
  } catch (e) {
    console.error("Error writing entries:", e)
  }
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const staff = await loadStaff()
  return NextResponse.json({ staff })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const name = (body.name || "").trim()
  const rate = Number.isFinite(body.rate) ? Number(body.rate) : 0
  const rateType: StaffMember["rateType"] = body.rateType === "day" ? "day" : "hour"

  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 })
  }

  const staff = await loadStaff()
  if (staff.some(s => s.name === name)) {
    return NextResponse.json({ error: "Staff member already exists" }, { status: 409 })
  }

  const updated = [...staff, { name, rate, rateType }]
  await saveStaff(updated)
  return NextResponse.json({ staff: updated })
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const originalName = (body.originalName || body.name || "").trim()
  const name = (body.name || "").trim()
  const rate = Number.isFinite(body.rate) ? Number(body.rate) : 0
  const rateType: StaffMember["rateType"] = body.rateType === "day" ? "day" : "hour"

  if (!originalName || !name) {
    return NextResponse.json({ error: "originalName and name required" }, { status: 400 })
  }

  const staff = await loadStaff()
  if (!staff.some(s => s.name === originalName)) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
  }
  if (name !== originalName && staff.some(s => s.name === name)) {
    return NextResponse.json({ error: "Name already exists" }, { status: 409 })
  }

  const updatedStaff = staff.map(s => (s.name === originalName ? { name, rate, rateType } : s))

  // Update entries to reflect rename
  const entries = await loadEntries()
  const updatedEntries = entries.map(e => (e.staff === originalName ? { ...e, staff: name } : e))

  await saveStaff(updatedStaff)
  await saveEntries(updatedEntries)

  return NextResponse.json({ staff: updatedStaff })
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const name = (request.nextUrl.searchParams.get("name") || "").trim()
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 })
  }

  const staff = await loadStaff()
  const updatedStaff = staff.filter(s => s.name !== name)
  const entries = await loadEntries()
  const filteredEntries = entries.filter(e => e.staff !== name)

  await saveStaff(updatedStaff)
  await saveEntries(filteredEntries)

  return NextResponse.json({ staff: updatedStaff })
}
