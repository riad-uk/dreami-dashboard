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
  legacy?: {
    appointmentTypes?: Array<{
      id: string
      name: string
    }>
  }
  // Extended details (fetched separately)
  customerEmail?: string
  customerPhone?: string
}
