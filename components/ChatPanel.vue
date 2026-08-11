<script setup lang="ts">
// ChatPanel.vue — 浮动私信面板
// 左：会话列表；右：与选中对象的聊天视图。支持实时收发。
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import {
  CloseOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  MessageOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { avatarStyle } from '~/composables/useAvatar'
import { useMessages } from '~/composables/useMessages'
import { useRealtime } from '~/composables/useRealtime'
import { useAuth } from '~/composables/useAuth'

const props = defineProps<{
  open: boolean
  initialPeerId?: string
}>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const { conversations, activeThread, activePeer, sending, fetchConversations, openConversation, sendMessage, receiveIncoming } = useMessages()
const { unreadCount, decUnread, onEvent } = useRealtime()
const { isLoggedIn, user } = useAuth()
const router = useRouter()

const inputText = ref('')
const threadScroll = ref<HTMLElement | null>(null)
const startedWithPeer = ref(false) // whether we jumped straight into a conversation

// Subscribe to incoming WS messages
let unsub: (() => void) | null = null

async function ensureLoaded() {
  if (!isLoggedIn.value) return
  await fetchConversations()
  if (props.initialPeerId) {
    startedWithPeer.value = true
    await openConversation(props.initialPeerId)
  }
}

watch(() => props.open, async (v) => {
  if (v) {
    await ensureLoaded()
    await nextTick()
    scrollToBottom()
  }
})
watch(() => props.initialPeerId, async (id) => {
  if (props.open && id) {
    await openConversation(id)
    startedWithPeer.value = true
    await nextTick()
    scrollToBottom()
  }
})

function close() { emit('update:open', false); startedWithPeer.value = false }

function backToList() {
  startedWithPeer.value = false
  activePeer.value = null
  fetchConversations().catch(() => {})
}

async function selectConversation(peerId: string) {
  await openConversation(peerId)
  startedWithPeer.value = true
  await nextTick()
  scrollToBottom()
}

async function send() {
  if (!activePeer.value || !inputText.value.trim() || sending.value) return
  const text = inputText.value
  inputText.value = ''
  await sendMessage(activePeer.value.id, text)
  await nextTick()
  scrollToBottom()
  // Refresh list ordering (last message moved up)
  fetchConversations().catch(() => {})
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function scrollToBottom() {
  const el = threadScroll.value
  if (el) el.scrollTop = el.scrollHeight
}

// Watch active thread growth to auto-scroll
watch(() => activeThread.value.length, async () => {
  await nextTick()
  scrollToBottom()
})

onMounted(() => {
  unsub = onEvent((e) => {
    if (e.type === 'message') {
      receiveIncoming(e.message)
    }
  })
})
onBeforeUnmount(() => { unsub?.() })

function timeFmt(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function viewProfile(id: string) {
  close()
  router.push(`/user/${id}`)
}

const noConversations = computed(() => !conversations.value.length && !startedWithPeer.value)
</script>

<template>
  <Teleport to="body">
    <Transition name="chat-slide">
      <div v-if="open" class="chat-panel glass-strong">
        <header class="cp-header">
          <button v-if="startedWithPeer && activePeer" class="cp-back" @click="backToList" aria-label="返回">
            <ArrowLeftOutlined />
          </button>
          <h3 class="cp-title">
            <MessageOutlined /> 私信
            <span v-if="unreadCount > 0" class="cp-unread">{{ unreadCount }}</span>
          </h3>
          <button class="cp-close" @click="close" aria-label="关闭"><CloseOutlined /></button>
        </header>

        <div class="cp-body">
          <!-- 会话列表 -->
          <template v-if="!startedWithPeer || !activePeer">
            <div v-if="noConversations" class="cp-empty">
              <MessageOutlined class="empty-icon" />
              <p>还没有私信会话</p>
              <span>去关注的人主页发起对话吧</span>
            </div>
            <div v-else class="conv-list">
              <button
                v-for="c in conversations"
                :key="c.peerId"
                class="conv-item"
                :class="{ unread: c.unread > 0 }"
                @click="selectConversation(c.peerId)"
              >
                <span class="conv-avatar" :style="avatarStyle(c.peerAvatarColor)">
                  {{ c.peerUsername.charAt(0).toUpperCase() }}
                </span>
                <div class="conv-info">
                  <div class="conv-top">
                    <span class="conv-name">{{ c.peerUsername }}</span>
                    <span class="conv-time">{{ timeFmt(c.lastCreatedAt) }}</span>
                  </div>
                  <p class="conv-last">{{ c.lastText }}</p>
                </div>
                <span v-if="c.unread > 0" class="conv-badge">{{ c.unread }}</span>
              </button>
            </div>
          </template>

          <!-- 单个会话视图 -->
          <template v-else>
            <div class="thread-header">
              <span class="thread-avatar" :style="avatarStyle(activePeer.avatarColor)" @click="viewProfile(activePeer.id)">
                {{ activePeer.username.charAt(0).toUpperCase() }}
              </span>
              <div class="thread-name-wrap">
                <span class="thread-name" @click="viewProfile(activePeer.id)">{{ activePeer.username }}</span>
                <button class="profile-link" @click="viewProfile(activePeer.id)">查看主页 →</button>
              </div>
            </div>

            <div ref="threadScroll" class="thread-messages">
              <div v-if="!activeThread.length" class="thread-empty">开始你们的对话吧～</div>
              <div
                v-for="m in activeThread"
                :key="m.id"
                class="msg-row"
                :class="{ mine: m.fromUserId === user?.id }"
              >
                <div class="msg-bubble">
                  <p class="msg-text">{{ m.text }}</p>
                  <span class="msg-time">{{ timeFmt(m.createdAt) }}</span>
                </div>
              </div>
            </div>

            <div class="thread-input">
              <textarea
                v-model="inputText"
                class="msg-input"
                rows="1"
                placeholder="输入消息，Enter 发送…"
                maxlength="1000"
                @keydown="onKeydown"
              />
              <button class="msg-send" :disabled="!inputText.trim() || sending" @click="send">
                <SendOutlined />
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="less">
.chat-panel {
  position: fixed; bottom: 20px; right: 20px; z-index: 1000;
  width: 380px; height: 540px; max-height: calc(100vh - 100px);
  border-radius: var(--radius-xl); overflow: hidden;
  display: flex; flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.cp-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.cp-back, .cp-close {
  background: var(--bg-subtle); border: none; border-radius: 50%;
  width: 30px; height: 30px; cursor: pointer; color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
  transition: all var(--dur-fast);
}
.cp-back:hover { color: var(--accent); }
.cp-close:hover { background: var(--danger); color: #fff; }
.cp-title {
  flex: 1; margin: 0; font-size: var(--text-md); font-weight: 700;
  color: var(--text-primary); display: flex; align-items: center; gap: 6px;
}
.cp-unread {
  background: var(--danger); color: #fff; font-size: 10px; font-weight: 700;
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: var(--radius-full);
  display: inline-flex; align-items: center; justify-content: center;
}

.cp-body { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }

.cp-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; color: var(--text-muted); padding: 24px; text-align: center;
}
.empty-icon { font-size: 40px; color: var(--accent); opacity: 0.6; }
.cp-empty p { margin: 0; font-size: var(--text-sm); color: var(--text-secondary); }
.cp-empty span { font-size: var(--text-xs); }

.conv-list { flex: 1; overflow-y: auto; padding: 6px 0; }
.conv-item {
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  padding: 10px 14px; background: none; border: none; cursor: pointer;
  transition: background var(--dur-fast);
}
.conv-item:hover { background: var(--accent-soft); }
.conv-item.unread { background: var(--accent-soft); }
.conv-avatar {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 600; font-size: var(--text-sm);
}
.conv-info { flex: 1; min-width: 0; }
.conv-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.conv-name { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
.conv-time { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.conv-last {
  margin: 2px 0 0; font-size: var(--text-xs); color: var(--text-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.conv-badge {
  background: var(--danger); color: #fff; font-size: 10px; font-weight: 700;
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: var(--radius-full);
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
}

.thread-header {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-bottom: 1px solid var(--border-color);
}
.thread-avatar {
  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 600; font-size: var(--text-sm);
}
.thread-name-wrap { display: flex; flex-direction: column; }
.thread-name { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); cursor: pointer; }
.thread-name:hover { color: var(--accent); }
.profile-link {
  background: none; border: none; padding: 0; cursor: pointer;
  font-size: 11px; color: var(--accent); text-align: left;
}
.profile-link:hover { text-decoration: underline; }

.thread-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.thread-empty { text-align: center; color: var(--text-muted); font-size: var(--text-sm); margin: auto; }
.msg-row { display: flex; }
.msg-row.mine { justify-content: flex-end; }
.msg-bubble {
  max-width: 75%; padding: 8px 12px; border-radius: var(--radius-lg);
  background: var(--bg-subtle); color: var(--text-primary);
  word-break: break-word;
}
.msg-row.mine .msg-bubble {
  background: var(--accent); color: #fff;
  border-bottom-right-radius: var(--radius-sm);
}
.msg-row:not(.mine) .msg-bubble { border-bottom-left-radius: var(--radius-sm); }
.msg-text { margin: 0; font-size: var(--text-sm); line-height: var(--leading-snug); white-space: pre-wrap; }
.msg-time { font-size: 10px; opacity: 0.7; display: block; margin-top: 3px; }

.thread-input {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 10px 12px; border-top: 1px solid var(--border-color); flex-shrink: 0;
}
.msg-input {
  flex: 1; resize: none; max-height: 100px;
  background: var(--bg-subtle); border: 1px solid var(--border-color);
  border-radius: var(--radius-md); padding: 8px 12px;
  font-size: var(--text-sm); color: var(--text-primary); outline: none;
  font-family: var(--font-sans); transition: border-color var(--dur-fast);
}
.msg-input:focus { border-color: var(--accent); }
.msg-send {
  background: var(--accent); color: #fff; border: none; border-radius: 50%;
  width: 38px; height: 38px; cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--dur-fast);
}
.msg-send:hover:not(:disabled) { background: var(--accent-hover); }
.msg-send:disabled { opacity: 0.4; cursor: not-allowed; }

.chat-slide-enter-active, .chat-slide-leave-active { transition: opacity var(--dur), transform var(--dur); }
.chat-slide-enter-from, .chat-slide-leave-to { opacity: 0; transform: translateY(20px) scale(0.97); }

@media (max-width: 600px) {
  .chat-panel { width: calc(100vw - 16px); right: 8px; bottom: 8px; height: calc(100vh - 80px); }
}
</style>
