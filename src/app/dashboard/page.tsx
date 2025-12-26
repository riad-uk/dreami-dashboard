export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#557355]">Welcome back</p>
            <h2 className="text-3xl font-bold text-gray-900">Dashboard Overview</h2>
            <p className="text-sm text-gray-600">Quick links to bookings and upcoming rota.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-gray-200 text-sm text-gray-700">
            Status
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-green-700">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Live
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Stats Card */}
          <div className="bg-white overflow-hidden shadow rounded-xl ring-1 ring-gray-100">
            <div className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-2xl">📅</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">Total Bookings</p>
                <p className="text-lg font-semibold text-gray-900">Coming soon</p>
              </div>
            </div>
          </div>

          {/* YCBM Link Card */}
          <a
            href="/dashboard/ycbm"
            className="bg-white overflow-hidden shadow rounded-xl ring-1 ring-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl">📖</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">YCBM Bookings</p>
                <p className="text-lg font-semibold text-blue-600">View bookings →</p>
              </div>
            </div>
          </a>

          {/* Rota placeholder */}
          <a
            href="/dashboard/rota"
            className="bg-white overflow-hidden shadow rounded-xl ring-1 ring-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-2xl">🗓️</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">Rota</p>
                <p className="text-lg font-semibold text-emerald-700">Plan shifts (coming soon)</p>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
