import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { router } from '@/router'
import { useAuthStore } from '@/store/authStore'

function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </ErrorBoundary>
  )
}

export default App
