import { useAuthStore } from '@/store/authStore'
import { NotificationBell } from './NotificationBell'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'

export function Header() {
  const { profile } = useAuthStore()

  if (!profile) return null

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 lg:px-6">
      <Sheet>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" />}>
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">导航菜单</SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-2 lg:hidden">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs">
          研
        </div>
        <span className="font-semibold">共研</span>
      </div>

      <div className="flex-1" />

      <div className="hidden lg:flex">
        <NotificationBell />
      </div>
    </header>
  )
}
