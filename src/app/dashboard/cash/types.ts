export type CashTransactionType = "Cash Payment" | "Purchase Payment" | "Other Outgoing"

export type CashTransaction = {
  id: string
  date: string // YYYY-MM-DD
  type: CashTransactionType
  amount: number // signed: Cash Payment positive, others negative
  details?: string
  createdAt: number
}

export type CashDay = {
  date: string // YYYY-MM-DD
  openingBalance: number
  transactions: CashTransaction[]
}
