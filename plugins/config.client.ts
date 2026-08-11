// plugins/config.client.ts
//
// 客户端配置引导 + WS 热重载同步：
//   1. 启动时从 /api/config 拉取最新公开配置（覆盖 useAppConfig 的默认值）
//   2. 订阅 WS config 事件 → 即时更新 useAppConfig（无需刷新页面）
//   3. 品牌标题热驱动：config.branding.siteTitle → document.title
//
// 这样 config.yml 的「热」键改动会即时反映到所有在线客户端。
import { defineNuxtPlugin } from '#app'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { useRealtime } from '~/composables/useRealtime'

export default defineNuxtPlugin(() => {
  const { config, fetchConfig, applyConfig } = useSiteConfig()
  const { onEvent } = useRealtime()

  // 1. 启动拉取最新配置
  fetchConfig()

  // 2. WS 热重载：服务端 config.yml 变更 → 广播 → 即时应用
  onEvent((e) => {
    if (e.type === 'config') applyConfig(e.config)
  })

  // 3. 品牌标题（响应式：配置热重载后自动更新）
  watch(
    () => config.value.branding.siteTitle,
    (title) => {
      if (title) document.title = title
    },
    { immediate: true },
  )
})
