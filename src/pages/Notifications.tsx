import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { timeAgo } from '@/components/shared/TimeAgo'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Notification } from '@/types/database'

export default function Notifications() {
  const { profile } = useAuthStore()
  const { decrementUnread } = useNotificationStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)

    setNotifications((data as Notification[]) ?? [])
    setLoading(false)
  }, [profile])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const markAsRead = async (notification: Notification) => {
    if (notification.is_read) return

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification.id)

    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
    )
    decrementUnread()
  }

  const markAllAsRead = async () => {
    if (!profile) return

    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds)

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    decrementUnread(unreadIds.length)
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">通知</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} 条未读` : '已全部读取'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-1.5">
            <CheckCheck className="h-3.5 w-3.5" />
            全部已读
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2 mt-2" />
              </CardContent>
            </Card>
          ))
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-8 w-8" />}
            title="暂无通知"
            description="有新消息时你会在这里收到提醒"
          />
        ) : (
          notifications.map((notification) => (
            <Card
              key={notification.id}
              className={notification.is_read ? 'opacity-60' : 'border-accent/30'}
            >
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {notification.link ? (
                      <Link
                        to={notification.link}
                        className="font-medium text-sm hover:underline"
                        onClick={() => markAsRead(notification)}
                      >
                        {notification.title}
                      </Link>
                    ) : (
                      <p className="font-medium text-sm">{notification.title}</p>
                    )}
                    {notification.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.body}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {timeAgo(notification.created_at)}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => markAsRead(notification)}
                      title="标为已读"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
