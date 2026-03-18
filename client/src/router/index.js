import { createRouter, createWebHistory } from 'vue-router'
import { currentUser, authLoading, loadUser } from '@/stores/auth.js'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/change-password',
    name: 'change-password',
    component: () => import('@/views/ForcePasswordChangeView.vue'),
  },
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/list/:userId',
    name: 'wishlist',
    component: () => import('@/views/WishlistView.vue'),
  },
  {
    path: '/my-list',
    name: 'my-list',
    component: () => import('@/views/MyListView.vue'),
  },
  {
    path: '/my-purchases',
    name: 'my-purchases',
    component: () => import('@/views/MyPurchasesView.vue'),
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

let initialAuthChecked = false

router.beforeEach(async (to) => {
  // Load user on first navigation
  if (!initialAuthChecked) {
    await loadUser()
    initialAuthChecked = true
  }

  const user = currentUser.value

  // Public routes: redirect logged-in users to home
  if (to.meta.public) {
    if (user) return { name: 'home' }
    return true
  }

  // Protected routes: redirect to login if not authenticated
  if (!user) return { name: 'login' }

  // Force password change
  if (user.force_password_change && to.name !== 'change-password') {
    return { name: 'change-password' }
  }

  return true
})

export default router
