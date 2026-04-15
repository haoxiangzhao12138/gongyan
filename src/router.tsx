import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AdminRoute } from '@/components/auth/AdminRoute'
import { AppLayout } from '@/components/layout/AppLayout'

import Login from '@/pages/Login'
import Register from '@/pages/Register'
import AuthCallback from '@/pages/AuthCallback'
import Pending from '@/pages/Pending'
import Dashboard from '@/pages/Dashboard'
import Board from '@/pages/Board'
import BoardNew from '@/pages/BoardNew'
import PostDetail from '@/pages/PostDetail'
import Profile from '@/pages/Profile'
import ProfileEdit from '@/pages/ProfileEdit'
import Notifications from '@/pages/Notifications'
import InviteManagement from '@/pages/InviteManagement'
import Approvals from '@/pages/admin/Approvals'
import Members from '@/pages/admin/Members'
import StarBoard from '@/pages/StarBoard'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallback />,
  },
  {
    path: '/pending',
    element: <Pending />,
  },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'board',
        element: <Board />,
      },
      {
        path: 'board/new',
        element: <BoardNew />,
      },
      {
        path: 'board/:postId',
        element: <PostDetail />,
      },
      {
        path: 'star-board',
        element: <StarBoard />,
      },
      {
        path: 'user/:userId',
        element: <Profile />,
      },
      {
        path: 'profile/edit',
        element: <ProfileEdit />,
      },
      {
        path: 'notifications',
        element: <Notifications />,
      },
      {
        path: 'invites',
        element: <InviteManagement />,
      },
      {
        path: 'admin/approvals',
        element: (
          <AdminRoute>
            <Approvals />
          </AdminRoute>
        ),
      },
      {
        path: 'admin/members',
        element: (
          <AdminRoute>
            <Members />
          </AdminRoute>
        ),
      },
    ],
  },
])
