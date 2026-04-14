import { NavLink } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  LayoutDashboard,
  MessageSquareText,
  User,
  Bell,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/store/notificationStore'

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex flex-col items-center gap-0.5 py-1 text-[10px] transition-colors relative',
    isActive ? 'text-accent' : 'text-muted-foreground'
  )

export function BottomNav() {
  const { profile } = useAuthStore()
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex items-center justify-around border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-2 pb-[env(safe-area-inset-bottom)]">
      <NavLink to="/" className={navClass} end>
        <LayoutDashboard className="h-5 w-5" />
        工作台
      </NavLink>
      <NavLink to="/board" className={navClass}>
        <MessageSquareText className="h-5 w-5" />
        看板
      </NavLink>
      <NavLink to="/star-board" className={navClass}>
        <Star className="h-5 w-5" />
        广场
      </NavLink>
      <NavLink to="/notifications" className={navClass}>
        <div className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        通知
      </NavLink>
      <NavLink to={`/user/${profile?.id}`} className={navClass}>
        <User className="h-5 w-5" />
        我的
      </NavLink>
    </nav>
  )
}
