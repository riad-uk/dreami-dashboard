import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

export async function GET(request: NextRequest) {
  const { userId: clerkUserId } = await auth()

  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const date = searchParams.get("date")

  const apiKey = process.env.YCBM_API_KEY
  const userId = process.env.YCBM_USER_ID

  console.log("Environment check:", {
    hasApiKey: !!apiKey,
    hasUserId: !!userId,
    apiKeyLength: apiKey?.length,
    userIdLength: userId?.length,
  })

  if (!apiKey || !userId) {
    console.error("❌ Missing YCBM credentials!", {
      apiKey: apiKey ? `${apiKey.substring(0, 5)}...` : "MISSING",
      userId: userId ? `${userId.substring(0, 8)}...` : "MISSING",
    })
    return NextResponse.json(
      { error: "YCBM API credentials not configured" },
      { status: 500 }
    )
  }

  try {
    // Use the newer /bookings/query endpoint for better filtering
    const params = new URLSearchParams()
    
    // Search by startsAt to get all bookings starting in the last 7 days
    params.append("searchTimeRangeCriteria", "startsAt")
    params.append("sortBy", "startsAt")
    params.append("pageSize", "500") // Max page size
    
    // Get bookings that start from 7 days ago
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - 7)
    params.append("from", fromDate.toISOString())
    
    console.log("Requested date:", date)
    console.log("Fetching bookings starting after:", fromDate.toISOString())

    const url = `https://api.youcanbook.me/v1/accounts/${userId}/bookings/query?${params.toString()}`

    console.log("Fetching YCBM bookings from:", url)
    console.log("API Key (first 10 chars):", apiKey?.substring(0, 10))
    console.log("User ID:", userId)

    // YCBM uses Basic auth with account ID as username and API key as password
    const authString = Buffer.from(`${userId}:${apiKey}`).toString('base64')

    const headers = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
    }

    const response = await fetch(url, {
      headers,
      cache: "no-store",
    })

    console.log("YCBM API response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ YCBM API error response:", errorText)
      console.error("Request details:", {
        url,
        status: response.status,
        headers: response.headers,
      })
      return NextResponse.json(
        {
          error: `YCBM API error: ${response.status}`,
          details: errorText.substring(0, 200),
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    const bookingPageId = process.env.YCBM_BOOKING_PAGE_ID
    const profileId = process.env.YCBM_PROFILE_ID
    let bookings = Array.isArray(data) ? data : []
    
    console.log("Raw API response count:", bookings.length)
    if (bookings.length > 0) {
      console.log("Sample booking:", JSON.stringify(bookings[0], null, 2))
    }
    
    const beforeFilterCount = bookings.length
    if (bookingPageId || profileId) {
      bookings = bookings.filter((b: any) =>
        (!bookingPageId || b.bookingPageId === bookingPageId) &&
        (!profileId || b.profileId === profileId)
      )
    }
    console.log("YCBM API response count:", bookings.length, {
      beforeFilter: beforeFilterCount,
      afterFilter: bookings.length,
      filteredByBookingPageId: !!bookingPageId,
      bookingPageId,
      filteredByProfileId: !!profileId,
      profileId,
    })
    return NextResponse.json({ bookings })
  } catch (error) {
    console.error("Error fetching YCBM bookings:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch bookings" },
      { status: 500 }
    )
  }
}
