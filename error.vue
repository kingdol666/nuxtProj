<template>
  <!--
    全局错误页（404 / 500）。Nuxt 出错时不会挂载 app.vue，因此这里自带
    最小布局与设计系统样式，保证错误态在所有路由下都能正常渲染。
  -->
  <div class="error-page" :class="{ dark: isDark }">
    <div class="error-card">
      <div class="error-code">{{ error?.statusCode || 500 }}</div>
      <h1 class="error-title">{{ title }}</h1>
      <p class="error-desc">{{ description }}</p>
      <div class="error-actions">
        <button class="btn btn-primary" @click="handleHome">
          {{ isDark ? '返回首页' : 'Back to Home' }}
        </button>
        <button class="btn btn-ghost" @click="handleReload">
          {{ isDark ? '刷新页面' : 'Reload' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface NuxtError {
  statusCode?: number
  statusMessage?: string
  message?: string
}

const props = defineProps<{ error: NuxtError }>()

const isDark = computed(() => {
  try {
    const raw = document.cookie
      .split('; ')
      .find((c) => c.startsWith('theme='))
      ?.split('=')[1]
    return raw === 'dark'
  } catch {
    return false
  }
})

const code = computed(() => props.error?.statusCode || 500)
const is404 = computed(() => code.value === 404)
const title = computed(() => (is404.value ? '页面不存在' : '服务器出错了'))
const description = computed(() =>
  is404.value
    ? '你访问的页面可能已被移动或删除。'
    : props.error?.statusMessage || props.error?.message || '发生未知错误，请稍后重试。',
)

function handleHome() {
  clearError({ redirect: '/application' })
}

function handleReload() {
  if (import.meta.client) location.reload()
}
</script>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-family: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f7f7fb;
  color: #1f2937;
}
.error-page.dark {
  background: #0f0f14;
  color: #f3f4f6;
}
.error-card {
  max-width: 460px;
  text-align: center;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 20px;
  padding: 48px 36px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08);
}
.error-page.dark .error-card {
  background: rgba(26, 26, 34, 0.7);
  border-color: rgba(255, 255, 255, 0.09);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
}
.error-code {
  font-size: 72px;
  font-weight: 700;
  line-height: 1;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.error-title {
  margin: 16px 0 8px;
  font-size: 22px;
  font-weight: 600;
}
.error-desc {
  margin: 0 0 28px;
  color: #6b7280;
  line-height: 1.6;
}
.error-page.dark .error-desc {
  color: #b8bcc8;
}
.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.btn {
  border: none;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-primary {
  background: #6366f1;
  color: #fff;
}
.btn-primary:hover {
  background: #4f46e5;
  transform: translateY(-1px);
}
.btn-ghost {
  background: transparent;
  color: inherit;
  border: 1px solid currentColor;
  opacity: 0.7;
}
.btn-ghost:hover {
  opacity: 1;
}
</style>
