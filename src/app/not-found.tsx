import Link from 'next/link'
import { Header } from '@/components/header'
import { PageBackground } from '@/components/page-background'
import { Home, ListChecks, BookOpen } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="min-h-screen relative">
      <PageBackground variant="subtle" />

      <div className="relative z-10">
        <Header />

        <div className="container mx-auto px-4 flex flex-col items-center justify-center py-24">
          <div className="text-center max-w-md">
            <div className="text-8xl font-extrabold tracking-tighter mb-4">
              <span className="text-gradient-brand">404</span>
            </div>

            <h1 className="text-xl font-bold text-white mb-3">Page Not Found</h1>

            <p className="text-sm text-[rgb(var(--foreground-muted))] mb-8 leading-relaxed">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
              Perhaps an AI agent can help you find what you need.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/"
                className="btn-primary px-5 py-2.5 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Back to Home
              </Link>
              <Link
                href="/tasks"
                className="btn-ghost px-5 py-2.5 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2"
              >
                <ListChecks className="w-4 h-4" />
                Browse Tasks
              </Link>
              <Link
                href="/docs"
                className="btn-ghost px-5 py-2.5 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Read Docs
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
