// server/routes/ws.ts
//
// WebSocket 入口：crossws via Nitro experimental.websocket。
// 浏览器在 WS 握手时自动携带同源 cookie，因此 open 阶段直接读取
// auth_token 完成认证 → 注册在线 → 消费离线消息队列。心跳保持活性。
import { verifyToken } from '~~/server/utils/auth'
import { register, unregister, drainPendingMessages } from '~~/server/utils/realtime'

function extractUserId(peer: { request?: { headers?: Headers } }): string | null {
  const cookieHeader = peer.request?.headers?.get('cookie')
  if (!cookieHeader) return null
  // Parse auth_token=... from the cookie header
  const raw = match[1]
  let token = raw
  try { token = decodeURIComponent(raw) } catch { /* malformed %; verifyToken will reject */ }
  const decoded = verifyToken(token)
  return decoded?.uid ?? null
}

export default defineWebSocketHandler({
  open(peer) {
    const userId = extractUserId(peer)
    if (!userId) {
      peer.send(JSON.stringify({ type: 'auth_error', message: 'unauthorized' }))
      peer.close(4001, 'unauthorized')
      return
    }
    peer.context.userId = userId
    register(userId, peer)
    peer.send(JSON.stringify({ type: 'auth_ok', userId }))
    // 上线即消费离线队列（fire-and-forget）
    drainPendingMessages(userId).catch(() => {})
  },

  message(peer, event) {
    const raw = event.text()
    let data: Record<string, unknown>
    try {
      data = JSON.parse(raw)
    } catch {
      return
    }
    // 心跳
    if (data.type === 'ping') {
      peer.send(JSON.stringify({ type: 'pong' }))
    }
  },

  close(peer) {
    const userId = peer.context.userId as string | undefined
    if (userId) unregister(userId, peer)
  },

  error(peer) {
    const userId = peer.context.userId as string | undefined
    if (userId) unregister(userId, peer)
  },
})
