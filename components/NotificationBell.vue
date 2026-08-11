<script setup lang="ts">
// NotificationBell.vue — 头部通知铃铛
// 实时显示：未读私信数 + 关注通知。点击展开下拉面板。
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  BellOutlined,
  MessageOutlined,
  UserAddOutlined,
  CheckOutlined,
} from '@ant-design/icons-vue'
import { avatarStyle } from '~/composables/useAvatar'
import { useRealtime } from '~/composables/useRealtime'
import { useMessages } from '~/composables/useMessages'
import { useAuth } from '~/composables/useAuth'

const props = defineProps<{ onOpenChat?: (peerId: string) => void }>()

const { unreadCount, followNotices, clearFollow, setUnread } = useRealtime()
const { fetchConversations } = useMessages()
const { isLoggedIn } = useAuth()
const router = useRouter()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const totalNotices = computed(() => unreadCount.value + followNotices.value.length)

function toggle() { open.value = !open.value }
function close() { open.value = false }

function onDocClick(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) close()
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  if (isLoggedIn.value) refreshCounts()
})
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

async function refreshCounts() {
  try {
    const res = await $fetch<{ count: number }>('/api/messages/unread')
    setUnread(res.count)
    await fetchConversations()
  } catch { /* keep existing */ }
}

watch(isLoggedIn, (v) => {
  if (v) refreshCounts()
})

function openChat(peerId: string) {
  props.onOpenChat?.(peerId)
  close()
}

function viewProfile(userId: string) {
  router.push(`/user/${userId}`)
  close()
}

function dismissFollow(userId: string) {
  clearFollow(userId)
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  return `${Math.floor(h / 24)}天前`
}
</script>

<template>
  <div v-if="isLoggedIn" ref="rootRef" class="notif-bell">
    <button class="bell-btn" :class="{ active: open }" @click.stop="toggle" aria-label="通知">
      <BellOutlined />
      <span v-if="totalNotices > 0" class="badge">{{ totalNotices > 99 ? '99+' : totalNotices }}</span>
    </button>

    <Transition name="popdown">
      <div v-if="open" class="notif-dropdown glass-strong">
        <header class="nd-head">
          <span>通知</span>
          <span v-if="totalNotices" class="nd-count">{{ totalNotices }} 条新</span>
        </header>

        <div class="nd-body">
          <!-- 关注通知 -->
          <div v-for="f in followNotices" :key="f.fromUserId + f.createdAt" class="nd-item">
            <span class="nd-avatar" :style="avatarStyle(f.fromAvatarColor)">
              {{ f.fromUsername.charAt(0).toUpperCase() }}
            </span>
            <div class="nd-content">
              <p class="nd-text">
                <strong>{{ f.fromUsername }}</strong> 关注了你
                <UserAddOutlined class="nd-icon-follow" />
              </p>
              <span class="nd-time">{{ timeAgo(f.createdAt) }}</span>
            </div>
            <div class="nd-actions">
              <button class="nd-mini-btn" @click="viewProfile(f.fromUserId)">查看</button>
              <button class="nd-mini-btn ghost" @click="dismissFollow(f.fromUserId)" aria-label="忽略">
                <CheckOutlined />
              </button>
            </div>
          </div>

          <!-- 未读私信入口 -->
          <button v-if="unreadCount > 0" class="nd-item clickable" @click="openChat('')">
            <span class="nd-avatar msg"><MessageOutlined /></span>
            <div class="nd-content">
              <p class="nd-text">
                你有 <strong>{{ unreadCount }}</strong> 条未读私信
              </p>
              <span class="nd-time">点击查看</span>
            </div>
          </button>

          <div v-if="!totalNotices" class="nd-empty">
            <BellOutlined class="empty-icon" />
            <p>暂无新通知</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="less">
.notif-bell { position: relative; }

.bell-btn {
  position: relative; background: none; border: none; cursor: pointer;
  width: 38px; height: 38px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-primary); font-size: 18px;
  transition: all var(--dur-fast);
}
.bell-btn:hover, .bell-btn.active { background: var(--accent-soft); color: var(--accent); }
.badge {
  position: absolute; top: 4px; right: 4px;
  background: var(--danger); color: #fff;
  font-size: 10px; font-weight: 700; line-height: 1;
  min-width: 17px; height: 17px; padding: 0 4px;
  border-radius: var(--radius-full);
  display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--bg-base);
}

.notif-dropdown {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 100;
  width: 340px; max-height: 440px; overflow-y: auto;
  border-radius: var(--radius-lg); padding: 0;
  box-shadow: var(--shadow-lg);
}
.nd-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 10px; border-bottom: 1px solid var(--border-color);
  font-weight: 700; color: var(--text-primary);
}
.nd-count { font-size: var(--text-xs); color: var(--accent); font-weight: 600; }
.nd-body { padding: 6px 0; }

.nd-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; width: 100%; text-align: left;
  background: none; border: none; cursor: default;
  transition: background var(--dur-fast);
}
.nd-item.clickable { cursor: pointer; }
.nd-item.clickable:hover { background: var(--accent-soft); }

.nd-avatar {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 600; font-size: var(--text-sm);
}
.nd-avatar.msg { background: var(--accent); font-size: 16px; }

.nd-content { flex: 1; min-width: 0; }
.nd-text { margin: 0; font-size: var(--text-sm); color: var(--text-primary); line-height: var(--leading-snug); }
.nd-text strong { font-weight: 600; }
.nd-icon-follow { color: var(--accent); margin-left: 4px; }
.nd-time { font-size: 11px; color: var(--text-muted); }

.nd-actions { display: flex; gap: 4px; flex-shrink: 0; }
.nd-mini-btn {
  background: var(--accent); color: #fff; border: none;
  border-radius: var(--radius-full); padding: 4px 10px;
  font-size: 11px; cursor: pointer; transition: all var(--dur-fast);
}
.nd-mini-btn:hover { background: var(--accent-hover); }
.nd-mini-btn.ghost { background: var(--bg-subtle); color: var(--text-secondary); }
.nd-mini-btn.ghost:hover { background: var(--success); color: #fff; }

.nd-empty { text-align: center; padding: 32px 16px; color: var(--text-muted); }
.empty-icon { font-size: 32px; margin-bottom: 8px; display: block; }
.nd-empty p { margin: 0; font-size: var(--text-sm); }

/* Transition matches Header user dropdown */
.popdown-enter-active, .popdown-leave-active { transition: opacity var(--dur-fast), transform var(--dur-fast); }
.popdown-enter-from, .popdown-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
