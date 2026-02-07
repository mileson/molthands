'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { RealtimeChannel } from '@supabase/supabase-js'

interface TaskChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: {
    id: string
    title: string
    status: string
    points: number
    progress: number
    [key: string]: any
  }
  old: {
    id: string
    [key: string]: any
  }
}

interface UseTaskRealtimeOptions {
  onTaskCreated?: (task: TaskChangePayload['new']) => void
  onTaskUpdated?: (task: TaskChangePayload['new']) => void
  onTaskDeleted?: (taskId: string) => void
  filter?: {
    status?: string
    creatorId?: string
    executorId?: string
  }
}

export function useTaskRealtime(options: UseTaskRealtimeOptions = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // 创建频道
    const channel = supabase.channel('tasks-changes')

    // 监听任务变更
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
      },
      (payload) => {
        const data = payload as unknown as TaskChangePayload

        switch (data.eventType) {
          case 'INSERT':
            options.onTaskCreated?.(data.new)
            break
          case 'UPDATE':
            options.onTaskUpdated?.(data.new)
            break
          case 'DELETE':
            options.onTaskDeleted?.(data.old.id)
            break
        }
      }
    )

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true)
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setIsConnected(false)
      }
    })

    setChannel(channel)

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { isConnected, channel }
}

// 任务日志实时订阅
interface TaskLogPayload {
  eventType: 'INSERT'
  new: {
    id: string
    taskId: string
    status: string | null
    progress: number | null
    message: string | null
    createdAt: string
  }
}

export function useTaskLogsRealtime(taskId: string) {
  const [logs, setLogs] = useState<TaskLogPayload['new'][]>([])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase.channel(`task-logs-${taskId}`)

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'task_logs',
        filter: `task_id=eq.${taskId}`,
      },
      (payload) => {
        const data = payload as unknown as TaskLogPayload
        setLogs((prev) => [data.new, ...prev])
      }
    )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [taskId])

  return { logs }
}

// 积分变更实时订阅
interface PointChangePayload {
  eventType: 'INSERT'
  new: {
    id: string
    agentId: string
    amount: number
    type: string
    balance: number
    createdAt: string
  }
}

export function usePointsRealtime(agentId: string) {
  const [balance, setBalance] = useState<number | null>(null)
  const [lastChange, setLastChange] = useState<PointChangePayload['new'] | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase.channel(`points-${agentId}`)

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'point_logs',
        filter: `agent_id=eq.${agentId}`,
      },
      (payload) => {
        const data = payload as unknown as PointChangePayload
        setBalance(data.new.balance)
        setLastChange(data.new)
      }
    )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [agentId])

  return { balance, lastChange }
}
