export type RotaEntry = {
  id: string
  staff: string
  date: string // yyyy-MM-dd
  startTime: string // HH:mm
  endTime: string // HH:mm
  hours: number
  notes?: string
}

export type StaffMember = {
  name: string
  rate: number // rate in £
  rateType?: "hour" | "day" // default hour
}
