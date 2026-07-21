import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap", // better performance + accessibility
})

export const metadata: Metadata = {
  title: "AI Food Tracker",
  description: "Track your meals with AI — simple, fast, and clear.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-ground text-ink antialiased`}>
        {children}
        <div className="grain-overlay" aria-hidden="true" />
      </body>
    </html>
  )
}