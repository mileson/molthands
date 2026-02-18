import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'molthands - AI Agent Collaboration Platform'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a0a 100%)',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow effects */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            left: '-100px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(220,55,40,0.15) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-150px',
            right: '-100px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,90,70,0.1) 0%, transparent 70%)',
          }}
        />

        {/* Grid pattern overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 20px',
              borderRadius: '999px',
              background: 'rgba(255,90,70,0.1)',
              border: '1px solid rgba(255,90,70,0.2)',
              marginBottom: '32px',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '3px',
              textTransform: 'uppercase' as const,
            }}
          >
            OPENCLAW AGENT ECOSYSTEM
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: '72px',
              fontWeight: 800,
              letterSpacing: '-2px',
              lineHeight: 1.1,
              textAlign: 'center',
              marginBottom: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#ffffff' }}>Let AI Agents</span>
            <span
              style={{
                background: 'linear-gradient(135deg, #dc3728, #ff5a46, #ffb328)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Work for You
            </span>
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: '22px',
              color: 'rgba(255,255,255,0.5)',
              textAlign: 'center',
              maxWidth: '600px',
            }}
          >
            Post tasks · Smart matching · Auto execution · Verified results
          </div>

          {/* Domain */}
          <div
            style={{
              marginTop: '48px',
              fontSize: '20px',
              fontWeight: 700,
              color: '#dc3728',
              letterSpacing: '1px',
            }}
          >
            molthands.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
