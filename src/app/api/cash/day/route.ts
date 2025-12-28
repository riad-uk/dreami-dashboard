import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { kv } from "@vercel/kv"

import type { CashDay, CashTransaction, CashTransactionType } from "@/app/dashboard/cash/types"

const KV_KEY = "cash-days"

const todayISO = () => new Date().toISOString().slice(0, 10)

const normalizeType = (t: unknown): CashTransactionType | null => {
  if (t === "Cash Payment" || t === "Purchase Payment" || t === "Other Outgoing") return t
  return null
}

const signedAmountForType = (type: CashTransactionType, amount: number) => {
  const abs = Math.abs(amount)
  return type === "Cash Payment" ? abs : -abs
}

const normalizeDetails = (d: unknown) => {
  if (typeof d !== "string") return ""
  return d.trim().replace(/\s+/g, " ")
}

const loadDays = async (): Promise<CashDay[]> => {
  try {
    const data = await kv.get<CashDay[]>(KV_KEY)
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.error("Error reading cash days:", e)
    return []
  }
}

const saveDays = async (days: CashDay[]) => {
  try {
    await kv.set(KV_KEY, days)
  } catch (e) {
    console.error("Error writing cash days:", e)
  }
}

const ensureDay = (days: CashDay[], date: string): CashDay => {
  const existing = days.find(d => d.date === date)
  if (existing) return existing
  const created: CashDay = { date, openingBalance: 0, transactions: [] }
  days.push(created)
  return created
}

const sortTransactions = (txns: CashTransaction[]) =>
  [...txns].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const date = request.nextUrl.searchParams.get("date") || todayISO()
  const days = await loadDays()
  const day = days.find(d => d.date === date) || { date, openingBalance: 0, transactions: [] }
  return NextResponse.json({ day: { ...day, transactions: sortTransactions(day.transactions || []) } })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const date = (body.date || todayISO()).toString().slice(0, 10)

  const days = await loadDays()
  const day = ensureDay(days, date)

  if (typeof body.openingBalance !== "undefined") {
    const opening = Number(body.openingBalance)
    if (!Number.isFinite(opening)) {
      return NextResponse.json({ error: "openingBalance must be a number" }, { status: 400 })
    }
    day.openingBalance = opening
    await saveDays(days)
    return NextResponse.json({ day: { ...day, transactions: sortTransactions(day.transactions || []) } })
  }

  const type = normalizeType(body.type)
  const amount = Number(body.amount)
  if (!type || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "type and amount (> 0) required" }, { status: 400 })
  }

  const details = normalizeDetails(body.details)
  const needsDetails = type === "Purchase Payment" || type === "Other Outgoing"
  if (needsDetails && !details) {
    return NextResponse.json({ error: "details required for outgoing transactions" }, { status: 400 })
  }

  const entry: CashTransaction = {
    id: `cash-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date,
    type,
    amount: signedAmountForType(type, amount),
    details: details || undefined,
    createdAt: Date.now(),
  }

  day.transactions = [...(day.transactions || []), entry]
  await saveDays(days)
  return NextResponse.json({ day: { ...day, transactions: sortTransactions(day.transactions || []) }, entry })
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const date = request.nextUrl.searchParams.get("date") || ""
  const id = request.nextUrl.searchParams.get("id") || ""
  if (!date || !id) {
    return NextResponse.json({ error: "date and id required" }, { status: 400 })
  }

  const days = await loadDays()
  const day = days.find(d => d.date === date)
  if (!day) {
    return NextResponse.json({ error: "Day not found" }, { status: 404 })
  }

  day.transactions = (day.transactions || []).filter(t => t.id !== id)
  await saveDays(days)
  return NextResponse.json({ day: { ...day, transactions: sortTransactions(day.transactions || []) } })
}
