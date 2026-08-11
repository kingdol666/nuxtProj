<script setup lang="ts">
// FollowButton.vue — 关注/已关注 切换按钮
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, CheckOutlined, UserAddOutlined } from '@ant-design/icons-vue'
import { useFollows } from '~/composables/useFollows'
import { useAuth } from '~/composables/useAuth'

const props = defineProps<{
  targetUserId: string
  initialFollowing?: boolean
  size?: 'small' | 'default' | 'large'
}>()
const emit = defineEmits<{ (e: 'change', following: boolean): void }>()

const { toggleFollow, isFollowing } = useFollows()
const { isLoggedIn, openAuthModal, user } = useAuth()

const localFollowing = ref(props.initialFollowing ?? false)
const loading = ref(false)

// Sync with composable cache (in case toggled elsewhere)
watch(
  () => isFollowing(props.targetUserId),
  (v) => { localFollowing.value = v },
)

async function onClick() {
  if (!isLoggedIn.value) { openAuthModal(); return }
  if (props.targetUserId === user.value?.id) return
  loading.value = true
  try {
    const following = await toggleFollow(props.targetUserId)
    localFollowing.value = following
    emit('change', following)
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string } }
    message.error(e?.data?.statusMessage || '操作失败')
  } finally {
    loading.value = false
  }
}

const isSelf = () => props.targetUserId === user.value?.id
</script>

<template>
  <button
    v-if="!isSelf()"
    class="follow-btn"
    :class="[`size-${size || 'default'}`, { following: localFollowing }]"
    :disabled="loading"
    @click="onClick"
  >
    <template v-if="loading">…</template>
    <template v-else-if="localFollowing">
      <CheckOutlined /><span>已关注</span>
    </template>
    <template v-else>
      <PlusOutlined /><span>关注</span>
    </template>
  </button>
</template>

<style scoped lang="less">
.follow-btn {
  display: inline-flex; align-items: center; gap: 5px;
  border: none; border-radius: var(--radius-full);
  cursor: pointer; font-weight: 600; white-space: nowrap;
  transition: all var(--dur-fast);
  font-family: var(--font-sans);
}
.follow-btn.size-small { padding: 4px 14px; font-size: var(--text-xs); }
.follow-btn.size-default { padding: 7px 20px; font-size: var(--text-sm); }
.follow-btn.size-large { padding: 10px 28px; font-size: var(--text-md); }

/* Default = primary (follow CTA) */
.follow-btn { background: var(--accent); color: #fff; }
.follow-btn:hover:not(:disabled):not(.following) { background: var(--accent-hover); transform: translateY(-1px); }

/* Following = subtle outline; hover hints unfollow */
.follow-btn.following {
  background: var(--glass-bg-strong); color: var(--text-secondary);
  border: 1px solid var(--border-color);
}
.follow-btn.following:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1); color: var(--danger); border-color: var(--danger);
}

.follow-btn:disabled { opacity: 0.6; cursor: wait; }
</style>
