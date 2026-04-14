import { NavLink } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  LayoutDashboard,
  MessageSquareText,
  User,
  Shield,
  Mail,
  LogOut,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
  )

export function Sidebar() {
  const { profile, signOut } = useAuthStore()

  return (
    <aside className="hidden lg:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
          研
        </div>
        <span className="text-lg font-semibold tracking-tight">共研</span>
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 space-y-1 px-3 py-4">
        <NavLink to="/" className={navLinkClass} end>
          <LayoutDashboard className="h-4 w-4" />
          工作台
        </NavLink>
        <NavLink to="/board" className={navLinkClass}>
          <MessageSquareText className="h-4 w-4" />
          互助看板
        </NavLink>
        <NavLink to="/star-board" className={navLinkClass}>
          <Star className="h-4 w-4" />
          互助广场
        </NavLink>
        <NavLink to={`/user/${profile?.id}`} className={navLinkClass}>
          <User className="h-4 w-4" />
          个人主页
        </NavLink>
        <NavLink to="/invites" className={navLinkClass}>
          <Mail className="h-4 w-4" />
          邀请管理
        </NavLink>

        {profile?.is_admin && (
          <>
            <Separator className="my-3 bg-sidebar-border" />
            <NavLink to="/admin/approvals" className={navLinkClass}>
              <Shield className="h-4 w-4" />
              审批管理
            </NavLink>
          </>
        )}
      </nav>

      <div className="px-3 pb-4">
        <Separator className="mb-3 bg-sidebar-border" />
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium">
            {profile?.full_name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.full_name}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">
              {profile?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
