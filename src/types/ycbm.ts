export interface YCBMBooking {
  id: string
  title: string
  starts: string
  startsAt: string
  startsAtUTC: string
  ends: string
  endsAt: string
  timeZone: string
  status: string
  ref: string
  accountId: string
  profileId: string
  bookingPageId: string
  cancelled: boolean
  tentative: boolean
  noShow: boolean
  createdAt: string
  organizer: string
  intentId?: string
  // Unit counts returned by the API (when multiple slots are booked in one go)
  units?: number
  unitCount?: number
  quantity?: number
  legacy?: {
    appointmentTypes?: Array<{
      id: string
      name: string
      units?: number
    }>
  }
  // Extended details (fetched separately)
  customerEmail?: string
  customerPhone?: string
  customerName?: string
}
