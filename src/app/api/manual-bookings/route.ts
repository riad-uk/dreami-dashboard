import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { kv } from "@vercel/kv"

const KV_KEY = "manual-bookings"

type ManualBooking = {
  id: string
  name: string
  bookingType: string
  note?: string
  sessionTime: string
  units: number
}

type ManualBookingsByDate = Record<string, ManualBooking[]>

async function readManual(): Promise<ManualBookingsByDate> {
  try {
    const data = await kv.get<ManualBookingsByDate>(KV_KEY)
    return data || {}
  } catch (e) {
    console.error("Error reading manual bookings:", e)
    return {}
  }
}

async function writeManual(data: ManualBookingsByDate) {
  try {
    await kv.set(KV_KEY, data)
  } catch (e) {
    console.error("Error writing manual bookings:", e)
  }
}

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const date = request.nextUrl.searchParams.get("date") || ""
  const manual = await readManual()

  if (date) {
    return NextResponse.json({ manualBookings: manual[date] || [] })
  }

  return NextResponse.json({ manualBookings: manual })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { date, booking } = body as { date?: string; booking?: ManualBooking }

  if (!date || !booking) {
    return NextResponse.json({ error: "date and booking required" }, { status: 400 })
  }

  const manual = await readManual()
  const list = manual[date] ? [...manual[date]] : []
  list.push(booking)
  manual[date] = list
  await writeManual(manual)

  return NextResponse.json({ ok: true, manualBookings: list })
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const date = request.nextUrl.searchParams.get("date") || ""
  const id = request.nextUrl.searchParams.get("id") || ""

  if (!date || !id) {
    return NextResponse.json({ error: "date and id required" }, { status: 400 })
  }

  const manual = await readManual()
  const list = manual[date] || []
  manual[date] = list.filter((b) => b.id !== id)
  await writeManual(manual)

  return NextResponse.json({ ok: true, manualBookings: manual[date] || [] })
}
