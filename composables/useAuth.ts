// composables/useAuth.ts
//
// 全局用户状态：SSR 安全的 useState + cookie 同步。
// 提供 register / login / logout / fetchMe 及登录态判断。
import { useState, computed } from '#imports'

export interface CurrentUser {
  id: string
  username: string
  role: 'admin' | 'user'
  avatarColor: number
  avatarUrl: string
  backgroundUrl: string
  bio: string
  createdAt: number
}

export const useAuth = () => {
  // 全局共享的用户状态（SSR 安全：服务端渲染时通过 /api/auth/me 预取）
  const user = useState<CurrentUser | null>('auth-user', () => null)
  const isLoggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  async function fetchMe() {
    try {
      const data = await $fetch<CurrentUser | null>('/api/auth/me')
      user.value = data
    } catch {
      user.value = null
    }
  }

  async function register(username: string, password: string) {
    const data = await $fetch<CurrentUser>('/api/auth/register', {
      method: 'POST',
      body: { username, password },
    })
    user.value = data
    return data
  }

  async function login(username: string, password: string) {
    const data = await $fetch<CurrentUser>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    user.value = data
    return data
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  async function updateProfile(data: { bio?: string; avatarUrl?: string; backgroundUrl?: string }) {
    const updated = await $fetch<CurrentUser>('/api/users/profile', {
      method: 'PUT',
      body: data,
    })
    user.value = updated
    return updated
  }

  // 触发登录弹窗（任何组件都可调用）
  const authModalOpen = useState<boolean>('auth-modal-open', () => false)
  function openAuthModal() { authModalOpen.value = true }
  function closeAuthModal() { authModalOpen.value = false }

  return { user, isLoggedIn, isAdmin, fetchMe, register, login, logout, updateProfile, authModalOpen, openAuthModal, closeAuthModal }
}
