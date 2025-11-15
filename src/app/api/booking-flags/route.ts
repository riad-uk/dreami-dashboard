import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import fs from "fs/promises"
import path from "path"

const filePath = path.join(process.cwd(), "data", "bookingFlags.json")

async function readFlags(): Promise<Record<string, { confirmed?: boolean; noShow?: boolean }>> {
  try {
    const data = await fs.readFile(filePath, "utf8")
    return JSON.parse(data)
  } catch (e) {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify({}), "utf8")
    return {}
  }
}

async function writeFlags(flags: Record<string, { confirmed?: boolean; noShow?: boolean }>) {
  await fs.writeFile(filePath, JSON.stringify(flags), "utf8")
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