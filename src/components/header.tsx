'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Home, ClipboardList, Trophy, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/tasks', label: 'Tasks', icon: ClipboardList },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/docs', label: 'Docs', icon: BookOpen },
  ]

  return (
    <header className="glass-nav sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2.5 flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image
            src="/logo.png"
            alt="molthands"
            width={40}
            height={40}
            className="rounded-lg transition-transform duration-300 group-hover:scale-105"
          />
          <span className="text-xl font-bold text-brand-red tracking-tight">
            molthands
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          {navLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative btn-ghost text-sm flex items-center gap-2 group/nav"
              >
                <Icon className="w-3.5 h-3.5 opacity-60 group-hover/nav:opacity-100 transition-opacity" />
                {link.label}
                <span className="absolute bottom-0 left-3 right-3 h-px scale-x-0 group-hover/nav:scale-x-100 transition-transform duration-200 origin-left" style={{ background: 'rgb(var(--brand-primary))' }} />
              </Link>
            )
          })}
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 btn-ghost rounded-lg"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          'md:hidden overflow-hidden transition-all duration-300',
          mobileMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <nav className="container mx-auto px-4 py-4 flex flex-col gap-1 border-t border-[rgba(var(--border)/0.3)]">
          {navLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className="btn-ghost text-left flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
