'use client'

import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { UserButton, useUser } from "@clerk/nextjs"
import Link from "next/link"
import { usePathname } from 'next/navigation'

const navigation = [
  { name: 'Overview', href: '/dashboard' },
  { name: 'Dreami Bookings', href: '/dashboard/ycbm' },
  { name: 'ROTA', href: '/dashboard/rota' },
]

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user } = useUser()

  return (
    <div className="min-h-full">
      <Disclosure as="nav" className="bg-[#557355]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <div className="shrink-0">
                <h1 className="text-xl font-bold text-white">Dreami Dashboard</h1>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  {navigation.map((item) => {
                    const isCurrent = pathname === item.href
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={classNames(
                          isCurrent
                            ? 'bg-[#3d5a3d] text-white'
                            : 'text-white hover:bg-[#4a6349]',
                          'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        )}
                      >
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="ml-4 flex items-center md:ml-6">
                <UserButton 
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8 rounded-full ring-2 ring-white"
                    }
                  }}
                  afterSignOutUrl="/"
                />
              </div>
            </div>
            <div className="-mr-2 flex md:hidden">
              <DisclosureButton className="group relative inline-flex items-center justify-center rounded-md bg-[#557355] p-2 text-white hover:bg-[#4a6349] focus:outline-2 focus:outline-offset-2 focus:outline-white">
                <span className="absolute -inset-0.5" />
                <span className="sr-only">Open main menu</span>
                <Bars3Icon aria-hidden="true" className="block size-6 group-data-open:hidden" />
                <XMarkIcon aria-hidden="true" className="hidden size-6 group-data-open:block" />
              </DisclosureButton>
            </div>
          </div>
        </div>

        <DisclosurePanel className="md:hidden">
          <div className="space-y-1 px-2 pt-2 pb-3 sm:px-3">
            {navigation.map((item) => {
              const isCurrent = pathname === item.href
              return (
                <DisclosureButton
                  key={item.name}
                  as={Link}
                  href={item.href}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={classNames(
                    isCurrent
                      ? 'bg-[#3d5a3d] text-white'
                      : 'text-white hover:bg-[#4a6349]',
                    'block rounded-md px-3 py-2 text-base font-medium',
                  )}
                >
                  {item.name}
                </DisclosureButton>
              )
            })}
          </div>
          <div className="border-t border-[#4a6349] pt-4 pb-3">
            <div className="flex items-center px-5">
              <div className="shrink-0">
                <UserButton 
                  appearance={{
                    elements: {
                      avatarBox: "w-10 h-10 rounded-full ring-2 ring-white"
                    }
                  }}
                  afterSignOutUrl="/"
                />
              </div>
              {user && (
                <div className="ml-3">
                  <div className="text-base font-medium text-white">{user.fullName}</div>
                  <div className="text-sm font-medium text-white/80">{user.primaryEmailAddress?.emailAddress}</div>
                </div>
              )}
            </div>
          </div>
        </DisclosurePanel>
      </Disclosure>

      <main>
        {children}
      </main>
    </div>
  )
}
