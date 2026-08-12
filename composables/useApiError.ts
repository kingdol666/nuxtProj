// composables/useApiError.ts
//
// 统一提取 $fetch / H3 错误中的友好信息。
// Nuxt 的 $fetch 在服务端返回非 2xx 时抛出 FetchError：
//   e.data       = H3 响应体 { statusCode, statusMessage, message, ... }
//   e.statusCode = HTTP 状态码
//   e.message    = 原始 HTTP 文本（"POST http://...: 4xx ()"）← 不适合展示
//
// 本函数按优先级提取最适合展示给用户的文案。

/** 默认兜底文案 */
const DEFAULT_MSG = '操作失败，请稍后重试'

/**
 * 从任意 unknown 错误中提取可展示的友好消息。
 * @param e catch 块捕获的错误（通常为 $fetch 的 FetchError）
 * @param fallback 兜底文案（默认「操作失败，请稍后重试」）
 */
export function apiError(e: unknown, fallback: string = DEFAULT_MSG): string {
  if (!e) return fallback
  // $fetch FetchError / H3 Error 的友好信息在 data.statusMessage
  const err = e as {
    data?: { statusMessage?: string; message?: string }
    statusMessage?: string
    message?: string
  }
  return (
    err?.data?.statusMessage ||
    err?.data?.message ||
    err?.statusMessage ||
    err?.message?.startsWith('POST ') || err?.message?.startsWith('GET ') || err?.message?.startsWith('PUT ') || err?.message?.startsWith('DELETE ')
      ? fallback  // 原始 HTTP 文本 → 不展示
      : err?.message ||
    fallback
  )
}
