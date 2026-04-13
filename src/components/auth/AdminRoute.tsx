import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { profile } = useAuthStore()

  if (!profile?.is_admin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
