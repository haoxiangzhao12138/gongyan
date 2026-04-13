import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Notification } from '@/types/database'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface NotificationState {
  unreadCount: number
  channel: RealtimeChannel | null
  subscribe: (userId: string) => void
  unsubscribe: () => void
  fetchUnreadCount: (userId: string) => Promise<void>
  decrementUnread: (count?: number) => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  channel: null,

  fetchUnreadCount: async (userId: string) => {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    set({ unreadCount: count ?? 0 })
  },

  subscribe: (userId: string) => {
    const existing = get().channel
    if (existing) {
      supabase.removeChannel(existing)
    }

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on<Notification>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          set((state) => ({ unreadCount: state.unreadCount + 1 }))
        }
      )
      .subscribe()

    set({ channel })
    get().fetchUnreadCount(userId)
  },

  unsubscribe: () => {
    const channel = get().channel
    if (channel) {
      supabase.removeChannel(channel)
      set({ channel: null, unreadCount: 0 })
    }
  },

  decrementUnread: (count = 1) => {
    set((state) => ({
      unreadCount: Math.max(0, state.unreadCount - count),
    }))
  },
}))
