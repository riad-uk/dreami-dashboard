"use client"

import { useEffect, useMemo, useState } from "react"
import type { CashDay, CashTransaction, CashTransactionType } from "./types"

const todayISO = () => new Date().toISOString().slice(0, 10)

const typeOptions: CashTransactionType[] = ["Cash Payment", "Purchase Payment", "Other Outgoing"]

const formatMoney = (n: number) => {
  const value = Number.isFinite(n) ? n : 0
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CashPage() {
  const [day, setDay] = useState<CashDay | null>(null)
  const [openingDraft, setOpeningDraft] = useState<string>("")
  const [type, setType] = useState<CashTransactionType>(typeOptions[0])
  const [amountDraft, setAmountDraft] = useState<string>("")
  const [detailsDraft, setDetailsDraft] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [savingOpening, setSavingOpening] = useState(false)
  const [savingTxn, setSavingTxn] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const date = todayISO()
  const isLocked = day ? day.date !== date : false

  const fetchDay = async () => {
    try {
      setError(null)
      setLoading(true)
      const res = await fetch(`/api/cash/day?date=${encodeURIComponent(date)}`, { cache: "no-store" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to load cash")
      }
      const data = await res.json()
      const loaded: CashDay = data.day || { date, openingBalance: 0, transactions: [] }
      setDay(loaded)
      setOpeningDraft(String(loaded.openingBalance ?? 0))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cash")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totals = useMemo(() => {
    const opening = day?.openingBalance ?? 0
    const txns = day?.transactions ?? []
    const net = txns.reduce((sum, t) => sum + (Number.isFinite(t.amount) ? t.amount : 0), 0)
    const closing = opening + net
    return { opening, net, closing, count: txns.length }
  }, [day])

  const saveOpening = async () => {
    if (!day) return
    const parsed = Number(openingDraft)
    if (!Number.isFinite(parsed)) {
      alert("Enter a valid opening balance")
      return
    }
    try {
      setSavingOpening(true)
      setError(null)
      const res = await fetch("/api/cash/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: day.date, openingBalance: parsed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save opening balance")
      }
      const data = await res.json()
      setDay(data.day)
      setOpeningDraft(String(data.day?.openingBalance ?? parsed))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save opening balance")
    } finally {
      setSavingOpening(false)
    }
  }

  const addTransaction = async () => {
    if (!day) return
    const parsed = Number(amountDraft)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      alert("Enter a valid amount (> 0)")
      return
    }
    const needsDetails = type !== "Cash Payment"
    const details = detailsDraft.trim()
    if (needsDetails && !details) {
      alert("Please add details for outgoing transactions")
      return
    }
    try {
      setSavingTxn(true)
      setError(null)
      const res = await fetch("/api/cash/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: day.date, type, amount: parsed, details }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to add entry")
      }
      const data = await res.json()
      setDay(data.day)
      setAmountDraft("")
      setDetailsDraft("")
      setType(typeOptions[0])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add entry")
    } finally {
      setSavingTxn(false)
    }
  }

  const deleteTransaction = async (id: string) => {
    if (!day) return
    if (!confirm("Delete this entry?")) return
    try {
      setDeletingId(id)
      setError(null)
      const res = await fetch(`/api/cash/day?id=${encodeURIComponent(id)}&date=${encodeURIComponent(day.date)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete entry")
      }
      const data = await res.json()
      setDay(data.day)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete entry")
    } finally {
      setDeletingId(null)
    }
  }

  const transactions: CashTransaction[] = day?.transactions ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#557355]">Cash</p>
            <h1 className="text-3xl font-bold text-gray-900">Cash float</h1>
            <p className="text-sm text-gray-600">Opening balance + today&apos;s cash movements. Locked after the day ends.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Today</p>
                <p className="text-xs text-gray-500">Entries are locked to today.</p>
              </div>
              {loading && <p className="text-xs text-gray-500">Loading…</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Date</label>
                <input
                  type="date"
                  value={date}
                  disabled
                  className="w-full rounded-lg border-0 bg-gray-100 px-3 py-2 text-sm text-gray-700 ring-1 ring-inset ring-gray-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Opening balance</label>
                <input
                  inputMode="decimal"
                  value={openingDraft}
                  onChange={e => setOpeningDraft(e.target.value)}
                  disabled={!day || isLocked || savingOpening}
                  className="w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355] disabled:bg-gray-100 disabled:text-gray-700"
                  placeholder="0.00"
                />
                <button
                  type="button"
                  onClick={saveOpening}
                  disabled={!day || isLocked || savingOpening}
                  className="mt-2 inline-flex items-center justify-center rounded-lg bg-[#557355] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#4a6349] disabled:opacity-50"
                >
                  {savingOpening ? "Saving…" : "Save opening balance"}
                </button>
              </div>
            </div>

            <div className="mt-2 rounded-xl bg-gray-50 p-4 ring-1 ring-gray-200 space-y-3">
              <p className="text-sm font-semibold text-gray-900">Add entry</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600">Type</label>
                  <select
                    value={type}
                    onChange={e => {
                      const nextType = e.target.value as CashTransactionType
                      setType(nextType)
                      if (nextType === "Cash Payment") setDetailsDraft("")
                    }}
                    disabled={!day || isLocked || savingTxn}
                    className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355] disabled:bg-gray-100 disabled:text-gray-700"
                  >
                    {typeOptions.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Amount</label>
                  <input
                    inputMode="decimal"
                    value={amountDraft}
                    onChange={e => setAmountDraft(e.target.value)}
                    disabled={!day || isLocked || savingTxn}
                    className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355] disabled:bg-gray-100 disabled:text-gray-700"
                    placeholder="0.00"
                  />
                </div>
              </div>
              {type !== "Cash Payment" && (
                <div className="mt-3 space-y-1">
                  <label className="text-xs font-medium text-gray-600">Details (required)</label>
                  <input
                    value={detailsDraft}
                    onChange={e => setDetailsDraft(e.target.value)}
                    disabled={!day || isLocked || savingTxn}
                    className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#557355] disabled:bg-gray-100 disabled:text-gray-700"
                    placeholder={type === "Purchase Payment" ? "What was purchased?" : "What was the money spent on?"}
                    required
                  />
                </div>
              )}
              <button
                type="button"
                onClick={addTransaction}
                disabled={!day || isLocked || savingTxn}
                className="inline-flex items-center justify-center rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-amber-300 disabled:opacity-50"
              >
                {savingTxn ? "Adding…" : "Add entry"}
              </button>

              <p className="text-xs text-gray-500">
                Cash Payment adds to the float. Purchase Payment and Other Outgoing subtract from the float.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Today&apos;s entries</p>
                <p className="text-xs text-gray-500">{totals.count} item(s)</p>
              </div>
            </div>

            <div className="space-y-2">
              {transactions.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
                  No entries yet.
                </div>
              )}
              {transactions.map(t => {
                const isPositive = t.amount >= 0
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-3 ring-1 ring-gray-200"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{t.type}</p>
                      <p className="text-xs text-gray-500">{t.details ? t.details : "Today"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`text-sm font-semibold tabular-nums ${isPositive ? "text-emerald-700" : "text-rose-700"}`}>
                        {isPositive ? "+" : ""}
                        {formatMoney(t.amount)}
                      </p>
                      <button
                        type="button"
                        onClick={() => deleteTransaction(t.id)}
                        disabled={isLocked || deletingId === t.id}
                        className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 disabled:opacity-50"
                      >
                        {deletingId === t.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 rounded-xl bg-white p-4 ring-1 ring-gray-200">
              <div className="flex items-center justify-between text-sm">
                <p className="text-gray-600">Opening balance</p>
                <p className="font-semibold tabular-nums text-gray-900">{formatMoney(totals.opening)}</p>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <p className="text-gray-600">Net change</p>
                <p className={`font-semibold tabular-nums ${totals.net >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {totals.net >= 0 ? "+" : ""}
                  {formatMoney(totals.net)}
                </p>
              </div>
              <div className="mt-3 border-t border-gray-200 pt-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Closing balance</p>
                <p className="text-lg font-bold tabular-nums text-gray-900">{formatMoney(totals.closing)}</p>
              </div>
            </div>
          </div>
        </div>

        {isLocked && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This day is locked and can&apos;t be edited.
          </div>
        )}
      </div>
    </div>
  )
}
