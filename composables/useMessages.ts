// composables/useMessages.ts
//
// 私信状态：会话列表、单条会话、发送、标记已读、未读数。
import { useState } from '#imports'
import { useRealtime } from './useRealtime'

export interface Message {
  id: string
  fromUserId: string
  toUserId: string
  text: string
  read: boolean
  delivered: boolean
  createdAt: number
}

export interface ConversationSummary {
  peerId: string
  peerUsername: string
  peerAvatarColor: number
  lastText: string
  lastCreatedAt: number
  unread: number
}

export interface ConversationPeer {
  id: string
  username: string
  avatarColor: number
  bio: string
}

export const useMessages = () => {
  const conversations = useState<ConversationSummary[]>('msg-conversations', () => [])
  const activeThread = useState<Message[]>('msg-thread', () => [])
  const activePeer = useState<ConversationPeer | null>('msg-peer', () => null)
  const unreadCount = useState<number>('msg-unread', () => 0)
  const sending = useState<boolean>('msg-sending', () => false)

  async function fetchConversations(): Promise<void> {
    const res = await $fetch<{ conversations: ConversationSummary[] }>('/api/messages')
    conversations.value = res.conversations
    unreadCount.value = res.conversations.reduce((s, c) => s + c.unread, 0)
    useRealtime().setUnread(unreadCount.value)
  }
  async function fetchUnread(): Promise<void> {
    try {
      const res = await $fetch<{ count: number }>('/api/messages/unread')
      unreadCount.value = res.count
      // 同步给 useRealtime（NotificationBell 用的是 realtime 的 unreadCount）
      useRealtime().setUnread(res.count)
    } catch {
      /* keep existing */
    }
  }

  async function openConversation(peerId: string): Promise<void> {
    const res = await $fetch<{ peer: ConversationPeer | null; messages: Message[] }>(
      '/api/messages',
      { params: { peerId } },
    )
    activePeer.value = res.peer
    activeThread.value = res.messages
    // Mark read
    const unreadFromPeer = conversations.value.find((c) => c.peerId === peerId)?.unread ?? 0
    if (unreadFromPeer > 0) {
      await $fetch('/api/messages/read', { method: 'POST', body: { peerId } })
      conversations.value = conversations.value.map((c) =>
        c.peerId === peerId ? { ...c, unread: 0 } : c,
      )
      // 同步未读总数到 realtime（NotificationBell）
      unreadCount.value = Math.max(0, unreadCount.value - unreadFromPeer)
      useRealtime().setUnread(unreadCount.value)
    }
  }

  async function sendMessage(toUserId: string, text: string): Promise<Message | null> {
    const trimmed = text.trim()
    if (!trimmed || sending.value) return null
    sending.value = true
    try {
      const res = await $fetch<{ message: Message }>('/api/messages', {
        method: 'POST',
        body: { toUserId, text: trimmed },
      })
      activeThread.value = [...activeThread.value, res.message]
      return res.message
    } finally {
      sending.value = false
    }
  }

  // Append a message received via WS to the active thread (if it belongs there)
  function receiveIncoming(message: Message): void {
    if (activePeer.value && (message.fromUserId === activePeer.value.id || message.toUserId === activePeer.value.id)) {
      activeThread.value = [...activeThread.value, message]
    }
    // Refresh conversation list ordering + sync real unread count from API
    fetchConversations().catch(() => {})
    // Re-fetch the authoritative unread count so the notification badge stays accurate
    // (prevents double-counting: WS dispatch increments ws-unread, but API is the source of truth)
    fetchUnread()
  }

  function clearActive(): void {
    activePeer.value = null
    activeThread.value = []
  }

  return {
    conversations,
    activeThread,
    activePeer,
    unreadCount,
    sending,
    fetchConversations,
    fetchUnread,
    openConversation,
    sendMessage,
    receiveIncoming,
    clearActive,
  }
}
