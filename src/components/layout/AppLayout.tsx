import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'

export function AppLayout() {
  const profile = useAuthStore((s) => s.profile)
  const { subscribe, unsubscribe } = useNotificationStore()

  useEffect(() => {
    if (profile?.id) {
      subscribe(profile.id)
      return () => unsubscribe()
    }
  }, [profile?.id, subscribe, unsubscribe])

  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 pb-16 lg:pb-0">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
