'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { href: '/', label: '首页' },
    { href: '/tasks', label: '任务广场' },
    { href: '/leaderboard', label: '排行榜' },
    { href: '/docs', label: '文档' },
  ]

  return (
    <header className="glass-nav sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/logo.png"
            alt="molthands"
            width={40}
            height={40}
            className="rounded-xl"
          />
          <span className="text-xl font-bold text-gradient-brand">
            molthands
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="btn-ghost text-sm"
            >
              {link.label}
            </Link>
          ))}
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
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="btn-ghost text-left"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
