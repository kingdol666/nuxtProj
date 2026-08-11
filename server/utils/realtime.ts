// server/utils/realtime.ts
//
// 实时通信核心：在线连接注册表 + 消息投递。
// - 用内存 Map<userId, Set<Peer>> 记录每个用户的活跃 WS 连接（同一用户可多端在线）。
// - sendToUser：若目标在线则即时推送；离线则返回 false，由调用方落库为待投递消息。
// - 进程重启后注册表清空，客户端会自动重连重新注册——可接受。
import type { Peer } from 'crossws'
import { getMessages, updateMessages, type Message } from './db'

// userId → 活跃连接集合
const online = new Map<string, Set<Peer>>()

export function register(userId: string, peer: Peer) {
  let conns = online.get(userId)
  if (!conns) {
    conns = new Set()
    online.set(userId, conns)
  }
  conns.add(peer)
}

export function unregister(userId: string, peer: Peer) {
  const conns = online.get(userId)
  if (!conns) return
  conns.delete(peer)
  if (conns.size === 0) online.delete(userId)
}

export function isOnline(userId: string): boolean {
  const conns = online.get(userId)
  return !!conns && conns.size > 0
}

// 推送一条数据给目标用户的所有活跃连接；返回是否至少送达一端。
export function sendToUser(userId: string, data: unknown): boolean {
  const conns = online.get(userId)
  if (!conns || conns.size === 0) return false
  const json = JSON.stringify(data)
  let delivered = false
  for (const peer of conns) {
    try {
      peer.send(json)
      delivered = true
    } catch {
      // 单个连接发送失败，从集合中移除，继续尝试其它连接
      conns.delete(peer)
    }
  }
  if (conns.size === 0) online.delete(userId)
  return delivered
}

// 广播一条数据给所有在线用户的所有活跃连接（用于全局通知，如配置热重载）。
export function broadcastToAll(data: unknown): void {
  if (online.size === 0) return
  const json = typeof data === 'string' ? data : JSON.stringify(data)
  for (const [userId, conns] of online) {
    for (const peer of conns) {
      try {
        peer.send(json)
      } catch {
        conns.delete(peer)
      }
    }
    if (conns.size === 0) online.delete(userId)
  }
}

// 用户上线时消费所有未投递的私信（离线队列）。
// 标记 delivered=true 并逐条推送。
export async function drainPendingMessages(userId: string): Promise<Message[]> {
  const pending = await getMessages()
  const mine = pending.filter((m) => m.toUserId === userId && !m.delivered)
  if (!mine.length) return []
  const ids = new Set(mine.map((m) => m.id))
  await updateMessages((all) => {
    for (const m of all) {
      if (ids.has(m.id)) m.delivered = true
    }
    return null
  })
  // 推送给当前连接
  for (const m of mine) sendToUser(userId, { type: 'message', message: m })
  return mine
}
