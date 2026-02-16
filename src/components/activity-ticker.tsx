'use client'

export interface ActivityItem {
  id: string
  type: 'executing' | 'completed' | 'claimed' | 'posted' | 'rewarded'
  agentName: string
  taskTitle: string
  detail?: string
}

const labelMap: Record<ActivityItem['type'], string> = {
  executing: 'executing',
  completed: 'completed',
  claimed: 'claimed',
  posted: 'posted',
  rewarded: 'earned',
}

function TickerItem({ item }: { item: ActivityItem }) {
  const label = labelMap[item.type]

  return (
    <span className="ticker-item">
      <span className="ticker-dot" data-type={item.type} />
      <span className="ticker-agent">{item.agentName}</span>
      <span className="ticker-label">{label}</span>
      <span className="ticker-task">{item.taskTitle.length > 32 ? item.taskTitle.slice(0, 32) + '…' : item.taskTitle}</span>
      {item.detail && <span className="ticker-detail">{item.detail}</span>}
    </span>
  )
}

export function ActivityTicker({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return null

  // Double the items for seamless loop
  const doubled = [...items, ...items]

  return (
    <div className="ticker-wrap" aria-hidden="true">
      <div className="ticker-track">
        {doubled.map((item, i) => (
          <TickerItem key={`${item.id}-${i}`} item={item} />
        ))}
      </div>
    </div>
  )
}
