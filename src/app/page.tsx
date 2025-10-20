import { redirect } from "next/navigation"
import { auth } from "@/auth"
import Link from "next/link"

export default async function Home() {
  const session = await auth()

  if (session?.user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl mx-auto text-center px-4">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Dreami Dashboard
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Your all-in-one business management platform
        </p>
        <Link
          href="/auth/signin"
          className="inline-block bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Get Started
        </Link>
      </div>
    </div>
  )
}
