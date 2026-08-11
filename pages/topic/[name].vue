<script setup lang="ts">
// pages/topic/[name].vue — 话题页
// 顶部：服务端生成的海报大图（小红书风格渐变 + 话题名 + 数据）
// 下方：该话题下的全部笔记瀑布流
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Post } from '~/composables/usePosts'
import { useAuth } from '~/composables/useAuth'

const route = useRoute()
const router = useRouter()
const { user, isLoggedIn, openAuthModal } = useAuth()

const topicName = computed(() => decodeURIComponent(route.params.name as string))
const posts = ref<Post[]>([])
const loading = ref(true)
const selectedPost = ref<Post | null>(null)
const detailOpen = ref(false)

const posterUrl = computed(() => `/api/poster/topic?name=${encodeURIComponent(topicName.value)}`)

async function loadPosts() {
  loading.value = true
  try {
    posts.value = await $fetch<Post[]>('/api/posts', { params: { tag: topicName.value } })
  } catch {
    posts.value = []
  } finally {
    loading.value = false
  }
}

async function onToggleLike(post: Post) {
  if (!isLoggedIn.value) { openAuthModal(); return }
  if (post.userId === user.value?.id) return
  try {
    const res = await $fetch<{ liked: boolean }>(`/api/posts/${post.id}/like`, { method: 'POST' })
    const uid = user.value?.id
    if (uid) {
      if (res.liked) { if (!post.likedBy.includes(uid)) post.likedBy.push(uid) }
      else { post.likedBy = post.likedBy.filter((u) => u !== uid) }
    }
  } catch { /* ignore */ }
}

function openDetail(post: Post) { selectedPost.value = post; detailOpen.value = true }
function goBack() { router.push('/community') }

watch(topicName, () => loadPosts(), { immediate: true })

const sortedPosts = computed(() => {
  return [...posts.value].sort((a, b) => b.likedBy.length - a.likedBy.length || b.createdAt - a.createdAt)
})

useHead({ title: () => `#${topicName.value} · 话题` })
</script>

<template>
  <div class="topic-page">
    <button class="back-btn glass-soft" @click="goBack">
      <ArrowLeftOutlined /> 返回社区
    </button>

    <!-- 话题海报 -->
    <div class="poster-wrapper">
      <img :src="posterUrl" :alt="`话题 ${topicName}`" class="topic-poster" />
    </div>

    <!-- 统计信息 -->
    <div class="topic-stats glass-soft">
      <div class="stat-item">
        <FireOutlined class="stat-icon" />
        <span class="stat-text">{{ sortedPosts.length }} 篇笔记</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <TeamOutlined class="stat-icon" />
        <span class="stat-text">{{ new Set(sortedPosts.map(p => p.userId)).size }} 位创作者</span>
      </div>
    </div>

    <!-- 笔记瀑布流 -->
    <main class="masonry" :class="{ loading }">
      <PostCard
        v-for="post in sortedPosts"
        :key="post.id"
        :post="post"
        :current-user-id="user?.id"
        @click="openDetail(post)"
        @toggle-like="onToggleLike(post)"
      />
      <div v-if="!loading && !sortedPosts.length" class="empty-state">
        <div class="empty-icon">📝</div>
        <h3>还没有人发布「{{ topicName }}」相关笔记</h3>
        <p>来当第一个分享的人吧！</p>
      </div>
    </main>

    <PostDetailModal v-model:open="detailOpen" :post="selectedPost" @toggle-like="onToggleLike" />
  </div>
</template>

<style scoped lang="less">
.topic-page { max-width: 1000px; margin: 0 auto; padding: 16px 20px 40px; }

.back-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border: none; border-radius: var(--radius-full);
  color: var(--text-secondary); cursor: pointer; font-size: var(--text-sm);
  margin-bottom: 16px; transition: all var(--dur-fast);
  &:hover { background: var(--accent-soft) !important; color: var(--accent); }
}

.poster-wrapper {
  width: 100%; max-width: 500px; margin: 0 auto 24px;
  border-radius: var(--radius-xl); overflow: hidden;
  box-shadow: var(--shadow-lg);
}
.topic-poster { width: 100%; display: block; }

.topic-stats {
  display: flex; align-items: center; justify-content: center; gap: 24px;
  padding: 16px 24px; border-radius: var(--radius-lg); margin-bottom: 24px;
}
.stat-item { display: flex; align-items: center; gap: 8px; }
.stat-icon { font-size: 20px; color: var(--accent); }
.stat-text { font-size: var(--text-md); font-weight: 600; color: var(--text-primary); }
.stat-divider { width: 1px; height: 24px; background: var(--border-color); }

.masonry {
  column-count: 2; column-gap: 16px;
  @media (min-width: 768px) { column-count: 3; }
  @media (min-width: 1024px) { column-count: 4; }
  &.loading { opacity: 0.5; }
}

.empty-state {
  column-span: all; text-align: center; padding: 60px 20px;
  .empty-icon { font-size: 48px; margin-bottom: 16px; }
  h3 { font-size: var(--text-lg); margin-bottom: 8px; }
  p { color: var(--text-secondary); }
}
</style>
