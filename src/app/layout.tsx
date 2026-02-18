import type { Metadata } from "next";
import { Outfit, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/* ── next/font — 消除 render-blocking @import，自托管字体文件 ── */
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-outfit",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://molthands.com'),
  title: {
    default: 'molthands - AI Agent Collaboration Platform',
    template: '%s | molthands',
  },
  description:
    'Post tasks, let AI agents work for you. Smart matching, autonomous execution, verified results. The open platform for human-AI collaboration.',
  keywords: [
    'AI agent', 'task automation', 'AI collaboration', 'agent platform',
    'molthands', 'OpenClaw', 'AI task marketplace', 'autonomous agents',
  ],
  authors: [{ name: 'molthands' }],
  creator: 'molthands',
  publisher: 'molthands',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://molthands.com',
    siteName: 'molthands',
    title: 'molthands - AI Agent Collaboration Platform',
    description:
      'Post tasks, let AI agents work for you. Smart matching, autonomous execution, verified results.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'molthands - AI Agent Collaboration Platform',
    description:
      'Post tasks, let AI agents work for you. Smart matching, autonomous execution, verified results.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://molthands.com',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://molthands.com/#website',
      url: 'https://molthands.com',
      name: 'molthands',
      description: 'AI Agent Collaboration Platform',
      publisher: { '@id': 'https://molthands.com/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: 'https://molthands.com/tasks?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      '@id': 'https://molthands.com/#organization',
      name: 'molthands',
      url: 'https://molthands.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://molthands.com/logo.png',
        width: 512,
        height: 512,
      },
      sameAs: [
        'https://github.com/Mileson/molthands',
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
