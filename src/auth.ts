import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

// Get allowed emails from environment variable
const allowedEmails = process.env.ALLOWED_EMAILS?.split(",").map(email => email.trim()) || []

// Validate required environment variables
if (!process.env.AUTH_SECRET) {
  console.error("❌ Missing AUTH_SECRET environment variable")
  console.error("Available env vars:", Object.keys(process.env).filter(key => key.includes('AUTH')))
}
if (!process.env.GOOGLE_CLIENT_ID) {
  console.error("❌ Missing GOOGLE_CLIENT_ID environment variable")
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  console.error("❌ Missing GOOGLE_CLIENT_SECRET environment variable")
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true, // Allow NextAuth to auto-detect the host from the request
  secret: process.env.AUTH_SECRET, // Explicitly set the secret
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // If no allowed emails are configured, allow all users
      if (allowedEmails.length === 0) {
        return true
      }

      // Check if the user's email is in the allowed list
      if (user.email && allowedEmails.includes(user.email)) {
        return true
      }

      // Deny access if email is not in the allowed list
      return false
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard")

      if (isOnDashboard) {
        if (isLoggedIn) return true
        return false // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl))
      }
      return true
    },
  },
})
