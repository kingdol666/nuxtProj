// composables/useTheme.ts
//
// 主题切换，SSR 安全、无闪烁（FOUC）：
// - 主题通过 cookie 持久化，服务端渲染时即可读到 → 首屏直接渲染正确配色。
// - 通过 nuxtApp hook 在 SSR 输出的 <html> 上内联写入 class，避免水合后再切换。
// - 客户端切换主题时同步更新 cookie、localStorage 与 <html> class。

import { useState, useCookie, watch, onMounted } from '#imports'
import type { Ref } from 'vue'

type ThemeMode = 'light' | 'dark'

export const useTheme = () => {
  const cookie = useCookie<ThemeMode>('theme', {
    default: () => 'light',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })

  const themeMode: Ref<ThemeMode> = useState('theme', () => cookie.value)

  const applyHtmlClass = (mode: ThemeMode) => {
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }

  // 服务端：在 SSR 输出的 <html> 上写入 class（首屏即正确，无闪烁）。
  const nuxtApp = useNuxtApp()
  nuxtApp.hook('app:rendered', () => {
    if (themeMode.value === 'dark') {
      useHead({ htmlAttrs: { class: 'dark' } })
    }
  })

  // 客户端：水合后统一 <html> class，并双向同步 cookie / localStorage。
  onMounted(() => {
    applyHtmlClass(themeMode.value)
  })

  watch(themeMode, (newMode) => {
    cookie.value = newMode
    if (import.meta.client) {
      localStorage.setItem('theme', newMode)
      applyHtmlClass(newMode)
    }
  })

  const toggleTheme = () => {
    themeMode.value = themeMode.value === 'light' ? 'dark' : 'light'
  }

  return { themeMode, toggleTheme }
}
