import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth()

  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: intentId } = await params
  const apiKey = process.env.YCBM_API_KEY
  const userId = process.env.YCBM_USER_ID

  if (!apiKey || !userId) {
    return NextResponse.json(
      { error: "YCBM API credentials not configured" },
      { status: 500 }
    )
  }

  try {
    const url = `https://api.youcanbook.me/v1/intents/${intentId}`

    const authString = Buffer.from(`${userId}:${apiKey}`).toString('base64')

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("YCBM API error response:", errorText)
      throw new Error(`YCBM API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // Extract email and phone from form data
    const formData = data.selections?.form || []
    const email = formData.find((f: any) => f.id === 'EMAIL')?.value
    const phone = formData.find((f: any) => f.id === 'Q7' || f.id.includes('PHONE'))?.value
    const getById = (ids: string[]) => formData.find((f: any) => f.id && ids.includes(String(f.id).toUpperCase()))?.value
    const getByLabel = (terms: string[]) =>
      formData.find((f: any) =>
        typeof f.label === 'string' &&
        terms.some(term => f.label.toLowerCase().includes(term))
      )?.value

    const firstName =
      getById(['FIRSTNAME', 'FIRST_NAME', 'FIRST', 'FNAME']) ||
      getByLabel(['first name', 'firstname', 'given name'])
    const lastName =
      getById(['LASTNAME', 'LAST_NAME', 'SURNAME', 'LNAME']) ||
      getByLabel(['last name', 'lastname', 'surname', 'family name'])
    const fullNameField =
      getById(['NAME', 'FULLNAME', 'FULL_NAME']) ||
      getByLabel(['full name', 'name'])

    // Fall back to top-level fields if present on the intent payload
    const intentFirst = data.customer?.firstName || data.booker?.firstName
    const intentLast = data.customer?.lastName || data.booker?.lastName
    const intentFull = data.customer?.name || data.booker?.name || data.name

    const name = (firstName || lastName)
      ? [firstName, lastName].filter(Boolean).join(' ').trim()
      : (intentFull || intentFirst || fullNameField || null)

    return NextResponse.json({
      email: email || null,
      phone: phone || null,
      name: name || null,
    })
  } catch (error) {
    console.error("Error fetching YCBM booking details:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch booking details" },
      { status: 500 }
    )
  }
}
