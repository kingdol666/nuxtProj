// composables/useAppConfig.ts
//
// 客户端配置状态：SSR 安全的 useState + WS 热重载同步。
//
// 用法：
//   const { config, branding, limits } = useAppConfig()
//   - config.value.branding.siteTitle  → 标题
//   - config.value.limits.posts.titleMax → 帖子标题上限
//
// 热重载：服务端 config.yml 变更 → WS 推送 → config 即时刷新（无需刷新页面）。
import { useState } from '#imports'

export interface PublicAppConfig {
  limits: {
    posts: { pageSize: number; titleMax: number; contentMax: number; maxTags: number; tagMaxLen: number }
    uploads: { maxMedia: number; maxVideos: number; maxImageSizeMB: number; maxVideoSizeMB: number }
    comments: { textMax: number }
  }
  realtime: { heartbeatIntervalMs: number; reconnectDelayMs: number }
  features: { enableSignup: boolean; enableGuestBrowse: boolean }
  wukongim: { enabled: boolean; wsURL: string }
  branding: { siteTitle: string; brandName: string; brandLogo: string }
  data: { cookieMaxAgeDays: number }
}

// 默认值（与服务端 DEFAULT_CONFIG 的公开子集保持一致），保证 SSR 首屏不闪烁
const DEFAULT_PUBLIC: PublicAppConfig = {
  limits: {
    posts: { pageSize: 20, titleMax: 100, contentMax: 5000, maxTags: 10, tagMaxLen: 20 },
    uploads: { maxMedia: 9, maxVideos: 4, maxImageSizeMB: 8, maxVideoSizeMB: 100 },
    comments: { textMax: 2000 },
  },
  realtime: { heartbeatIntervalMs: 25000, reconnectDelayMs: 3000 },
  features: { enableSignup: true, enableGuestBrowse: true },
  wukongim: { enabled: false, wsURL: 'ws://localhost:5200' },
  branding: { siteTitle: 'Nuxt Community', brandName: 'Nuxt Admin', brandLogo: '/logo.ico' },
  data: { cookieMaxAgeDays: 30 },
}

export const useSiteConfig = () => {
  const config = useState<PublicAppConfig>('app-config', () => ({ ...DEFAULT_PUBLIC }))

  // SSR + 客户端首次加载时从 /api/config 拉取最新值
  async function fetchConfig() {
    try {
      const data = await $fetch<PublicAppConfig>('/api/config')
      config.value = data
    } catch {
      // 保持默认值
    }
  }

  // 由 WS 热重载推送调用：即时替换内存中的配置
  function applyConfig(next: PublicAppConfig) {
    config.value = next
  }

  return { config, fetchConfig, applyConfig }
}
