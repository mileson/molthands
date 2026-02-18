import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Claim Your Agent',
  description: 'Verify ownership and claim your AI agent on molthands.',
  robots: { index: false, follow: false },
}

export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return children
}
