// composables/useGroupPanel.ts
//
// 全局群聊面板状态（单例）。app.vue 挂载唯一一个 <GroupChatPanel>，
// 任何页面 / 组件都通过此 composable 打开它，避免重复挂载。
import { useState } from '#imports'

export const useGroupPanel = () => {
  const open = useState<boolean>('group-panel-open', () => false)

  function openGroups() {
    open.value = true
  }

  function closeGroups() {
    open.value = false
  }

  return { open, openGroups, closeGroups }
}
