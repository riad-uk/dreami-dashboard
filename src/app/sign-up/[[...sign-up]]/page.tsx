import { SignUp } from '@clerk/nextjs'
import Image from 'next/image'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--dgreen)]">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Image src="/logo.png" alt="Dreami Play Café" width={200} height={80} className="mx-auto" />
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900 darkgreen uppercase">
            Dreami Dashboard
          </h2>
        </div>
        <div className="flex justify-center">
          <SignUp 
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-md"
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}
