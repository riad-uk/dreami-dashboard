import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Dreami Dashboard
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to access your business management tools
          </p>
        </div>
        <div className="flex justify-center">
          <SignIn 
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
