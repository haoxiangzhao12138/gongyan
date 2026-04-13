import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNotificationStore } from '@/store/notificationStore'

export function NotificationBell() {
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  return (
    <Link
      to="/notifications"
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
