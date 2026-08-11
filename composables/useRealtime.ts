// composables/useRealtime.ts
//
// WebSocket 客户端：单例连接，自动认证 + 心跳 + 断线重连。
// 提供全局事件流（消息/关注/在线状态），供 NotificationBell / ChatPanel 订阅。
import { useState } from '#imports'
import { useSiteConfig, type PublicAppConfig } from './useSiteConfig'
export type FollowNotice = {
  fromUserId: string
  fromUsername: string
  fromAvatarColor: number
  createdAt: number
}

export type RealtimeEvent =
  | { type: 'message'; message: Message }
  | { type: 'follow'; fromUserId: string; fromUsername: string; fromAvatarColor: number; createdAt: number }
  | { type: 'auth_ok'; userId: string }
  | { type: 'auth_error'; message: string }
  | { type: 'config'; config: PublicAppConfig }
  | { type: 'pong' }
type EventSubscriber = (e: RealtimeEvent) => void
type TimerHandle = ReturnType<typeof setInterval>

const subscribers = new Set<EventSubscriber>()

export const useRealtime = () => {
  const connected = useState<boolean>('ws-connected', () => false)
  const unreadCount = useState<number>('ws-unread', () => 0)
  const followNotices = useState<FollowNotice[]>('ws-follow-notices', () => [])
  const lastMessage = useState<Message | null>('ws-last-message', () => null)
  // 配置驱动的心跳/重连间隔（来自 config.yml，支持热重载）
  const { config: appConfig } = useSiteConfig()
  const heartbeatMs = () => appConfig.value.realtime.heartbeatIntervalMs
  const reconnectMs = () => appConfig.value.realtime.reconnectDelayMs
  let ws: WebSocket | null = null
  let heartbeatTimer: TimerHandle | null = null
  let reconnectTimer: TimerHandle | null = null
  let manualClose = false

  function dispatch(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return
    const data = raw as Record<string, unknown>
    const type = data.type
    if (typeof type !== 'string') return

    let e: RealtimeEvent | null = null
    if (type === 'message' && data.message && typeof data.message === 'object') {
      e = { type: 'message', message: data.message as Message }
    } else if (type === 'follow') {
      e = {
        type: 'follow',
        fromUserId: String(data.fromUserId ?? ''),
        fromUsername: String(data.fromUsername ?? ''),
        fromAvatarColor: Number(data.fromAvatarColor ?? 0),
        createdAt: Number(data.createdAt ?? Date.now()),
      }
    } else if (type === 'auth_ok') {
      e = { type: 'auth_ok', userId: String(data.userId ?? '') }
    } else if (type === 'auth_error') {
      e = { type: 'auth_error', message: String(data.message ?? '') }
    } else if (type === 'config' && data.config && typeof data.config === 'object') {
      e = { type: 'config', config: data.config as PublicAppConfig }
    } else if (type === 'pong') {
      e = { type: 'pong' }
    }
    if (!e) return

    for (const fn of subscribers) {
      try { fn(e) } catch { /* subscriber error is non-fatal */ }
    }
    if (e.type === 'message') {
      lastMessage.value = e.message
      // 不在此处盲目 +1：WS 消息可能来自离线队列消费（已被 API 计入），
      // 盲目递增会导致与 API 真实未读数不一致（重复计数）。
      // 未读数由消费方（ChatPanel → fetchUnread → setUnread）按 API 真值同步。
    } else if (e.type === 'follow') {
      const notice: FollowNotice = {
        fromUserId: e.fromUserId,
        fromUsername: e.fromUsername,
        fromAvatarColor: e.fromAvatarColor,
        createdAt: e.createdAt,
      }
      followNotices.value = [notice, ...followNotices.value].slice(0, 20)
    }
  }

  function onEvent(fn: EventSubscriber): () => void {
    subscribers.add(fn)
    return () => { subscribers.delete(fn) }
  }

  function clearFollow(id: string): void {
    followNotices.value = followNotices.value.filter((f) => f.fromUserId !== id)
  }

  function connect(): void {
    if (!import.meta.client) return
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
    manualClose = false

    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${location.host}/_ws`
    ws = new WebSocket(url)
    ws.onopen = () => {
      connected.value = true
      // Cookie is sent automatically on WS handshake; server auths in open()
      clearInterval(heartbeatTimer ?? undefined)
      heartbeatTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
      }, heartbeatMs())
    }

    ws.onmessage = (ev) => {
      let data: unknown
      try { data = JSON.parse(ev.data) } catch { return }
      dispatch(data)
    }

    ws.onclose = () => {
      connected.value = false
      clearInterval(heartbeatTimer ?? undefined)
      heartbeatTimer = null
      if (!manualClose) {
        clearTimeout(reconnectTimer ?? undefined)
        reconnectTimer = setTimeout(() => connect(), reconnectMs())
      }
    }

    ws.onerror = () => {
      try { ws?.close() } catch { /* onclose handles reconnect */ }
    }
  }

  function disconnect(): void {
    manualClose = true
    clearTimeout(reconnectTimer ?? undefined)
    reconnectTimer = null
    clearInterval(heartbeatTimer ?? undefined)
    heartbeatTimer = null
    try { ws?.close() } catch { /* already closed */ }
    ws = null
    connected.value = false
  }

  return {
    connected,
    unreadCount,
    followNotices,
    lastMessage,
    connect,
    disconnect,
    onEvent,
    clearFollow,
    setUnread: (n: number): void => { unreadCount.value = n },
    decUnread: (n: number): void => { unreadCount.value = Math.max(0, unreadCount.value - n) },
  }
}
