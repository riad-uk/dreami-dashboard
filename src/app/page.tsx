import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import Link from "next/link"

export default async function Home() {
  const { userId } = await auth()

  if (userId) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-white">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-lg">
              D
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-700">Dreami</p>
              <p className="text-xs text-gray-500">Dashboard</p>
            </div>
          </div>
          <Link
            href="/sign-in"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Sign in
          </Link>
        </header>

        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Operate with clarity</p>
              <h1 className="mt-3 text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
                Manage bookings, teams, and days with ease.
              </h1>
            </div>
            <p className="text-lg text-gray-600">
              A single dashboard for live bookings, manual overrides, and the upcoming rota view.
              Keep everyone aligned without hopping between tools.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/sign-in"
                className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow hover:bg-blue-700 transition-colors"
              >
                Get started
              </Link>
              <span className="text-sm text-gray-500">Secure login via Clerk</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-tr from-blue-200/60 via-white to-indigo-100 blur-2xl" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-gray-200">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Dashboard Preview</p>
                  <p className="text-sm text-gray-500">Live view of sessions and manual entries</p>
                </div>
                <div className="flex -space-x-2">
                  <span className="h-9 w-9 rounded-full bg-blue-100 border border-white flex items-center justify-center text-blue-700 text-xs font-bold">M</span>
                  <span className="h-9 w-9 rounded-full bg-indigo-100 border border-white flex items-center justify-center text-indigo-700 text-xs font-bold">S</span>
                  <span className="h-9 w-9 rounded-full bg-amber-100 border border-white flex items-center justify-center text-amber-700 text-xs font-bold">K</span>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-gradient-to-br from-blue-50 to-white border border-blue-100 p-4">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Bookings</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">124</p>
                    <p className="text-xs text-gray-500">Today across all sessions</p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 p-4">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Units</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">86</p>
                    <p className="text-xs text-gray-500">Manual + YCBM</p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-amber-50 to-white border border-amber-100 p-4">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Rota</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">Coming Soon</p>
                    <p className="text-xs text-gray-500">Staffing & shifts</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-800 mb-2">Stay on top of sessions</p>
                  <div className="h-2 w-full rounded-full bg-white border border-gray-200 overflow-hidden">
                    <div className="h-full w-3/5 bg-gradient-to-r from-blue-500 to-indigo-500" />
                  </div>
                  <p className="mt-3 text-xs text-gray-500">Automated capacity tracking with manual overrides when needed.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
