import type { Metadata, Viewport } from "next"
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

// Proper mobile viewport: device-width scaling, notch/home-indicator
// safe-area support, and a theme-color so the iOS status bar matches
// the app's dark background instead of flashing white.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0c10",
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