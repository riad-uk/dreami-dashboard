import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user) {
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
    // Build the API URL - YCBM requires targetAccountId and displayTimeZone as query params
    const params = new URLSearchParams()
    params.append("targetAccountId", userId)
    params.append("displayTimeZone", "UTC")

    // Add date filter if provided
    if (date) {
      const startDate = new Date(date)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(date)
      endDate.setHours(23, 59, 59, 999)

      params.append("startsAfter", startDate.toISOString())
      params.append("startsBefore", endDate.toISOString())
    }

    const url = `https://api.youcanbook.me/v1/bookings?${params.toString()}`

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
    console.log("YCBM API response data:", JSON.stringify(data).substring(0, 200))
    // YCBM API returns array directly, wrap it for consistent response format
    return NextResponse.json({ bookings: data })
  } catch (error) {
    console.error("Error fetching YCBM bookings:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch bookings" },
      { status: 500 }
    )
  }
}
