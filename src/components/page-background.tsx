interface PageBackgroundProps {
  variant?: 'full' | 'subtle'
}

export function PageBackground({ variant = 'full' }: PageBackgroundProps) {
  if (variant === 'subtle') {
    return (
      <>
        {/* 简化版星空背景 */}
        <div className="stars-bg" />
        {/* 网格背景 */}
        <div className="fixed inset-0 grid-bg pointer-events-none z-0" />
      </>
    )
  }

  return (
    <>
      {/* 星空背景 */}
      <div className="stars-bg" />

      {/* 渐变光斑 */}
      <div className="gradient-orb orb-red" style={{ top: '10%', left: '10%' }} />
      <div className="gradient-orb orb-cyan" style={{ top: '20%', right: '15%' }} />
      <div className="gradient-orb orb-purple" style={{ bottom: '30%', left: '30%' }} />

      {/* 网格背景 */}
      <div className="fixed inset-0 grid-bg pointer-events-none z-0" />
    </>
  )
}
