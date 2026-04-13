import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { router } from '@/router'
import { useAuthStore } from '@/store/authStore'

function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </>
  )
}

export default App
