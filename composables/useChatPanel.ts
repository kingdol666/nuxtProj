// composables/useChatPanel.ts
//
// 全局私信面板状态（单例）。app.vue 挂载唯一一个 <ChatPanel>，
// 任何页面 / 组件都通过此 composable 打开它，避免重复挂载导致
// 重复订阅 WS 事件 / 消息重复渲染。
import { useState } from '#imports'

export const useChatPanel = () => {
  const open = useState<boolean>('chat-panel-open', () => false)
  const initialPeerId = useState<string | undefined>('chat-panel-peer', () => undefined)

  function openChat(peerId?: string) {
    initialPeerId.value = peerId
    open.value = true
  }

  function closeChat() {
    open.value = false
  }

  return { open, initialPeerId, openChat, closeChat }
}
