import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { kv } from "@vercel/kv"

const KV_KEY = "booking-flags"

async function readFlags(): Promise<Record<string, { confirmed?: boolean; noShow?: boolean }>> {
  try {
    const flags = await kv.get<Record<string, { confirmed?: boolean; noShow?: boolean }>>(KV_KEY)
    return flags || {}
  } catch (e) {
    console.error("Error reading from KV:", e)
    return {}
  }
}

async function writeFlags(flags: Record<string, { confirmed?: boolean; noShow?: boolean }>) {
  try {
    await kv.set(KV_KEY, flags)
  } catch (e) {
    console.error("Error writing to KV:", e)
  }
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const flags = await readFlags()
  return NextResponse.json({ flags })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.json()
  const { bookingId, confirmed, noShow } = body as { bookingId: string; confirmed?: boolean; noShow?: boolean }
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 })
  const flags = await readFlags()
  const current = flags[bookingId] || {}
  const next = { ...current }
  if (typeof confirmed === "boolean") next.confirmed = confirmed
  if (typeof noShow === "boolean") next.noShow = noShow
  flags[bookingId] = next
  await writeFlags(flags)
  return NextResponse.json({ ok: true })
}