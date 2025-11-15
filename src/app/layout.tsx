import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs'
import "./globals.scss";

export const metadata: Metadata = {
  title: "Dreami Dashboard",
  description: "Business management platform for Dreami",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

