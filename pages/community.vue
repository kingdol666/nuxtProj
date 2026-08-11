<script setup lang="ts">
// pages/community.vue — 社区主页（小红书风格瀑布流）
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, SearchOutlined, FireOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { usePosts, type Post } from '~/composables/usePosts'
import { useCollections } from '~/composables/useCollections'
import { useAuth } from '~/composables/useAuth'

const { posts, loading, fetchPosts, toggleLike, updatePost, removePost, allTags } = usePosts()
const { fetchCollections } = useCollections()
const { user, isLoggedIn, openAuthModal } = useAuth()

const activeTag = ref<string>('')
const searchKeyword = ref('')
const searchInput = ref('')
const trendingTopics = ref<{ name: string; postCount: number }[]>([])

// Modals
const selectedPost = ref<Post | null>(null)
const detailOpen = ref(false)
const editorOpen = ref(false)
const editingPost = ref<Post | null>(null)

// Sorted by hot (likes) or latest
const sortMode = ref<'latest' | 'hot' | 'following'>('latest')
const displayPosts = computed(() => {
  const list = [...posts.value]
  if (activeTag.value) {
    // tag filter already applied via fetch, but keep for client-side safety
  }
  if (sortMode.value === 'hot') {
    list.sort((a, b) => b.likedBy.length - a.likedBy.length || b.createdAt - a.createdAt)
  }
  return list
})

async function refresh() {
  if (sortMode.value === 'following') {
    await fetchFollowingFeed()
    return
  }
  await fetchPosts({ tag: activeTag.value || undefined, keyword: searchKeyword.value || undefined, reset: true })
}

async function fetchFollowingFeed() {
  try {
    const data = await $fetch<Post[]>('/api/feed/following')
    posts.value = data
  } catch {
    posts.value = []
  }
}

function applyTag(tag: string) {
  activeTag.value = activeTag.value === tag ? '' : tag
  refresh()
}

function applySearch() {
  searchKeyword.value = searchInput.value.trim()
  refresh()
}

function toggleSort(mode: 'latest' | 'hot' | 'following') {
  sortMode.value = mode
  if (mode === 'following') refresh()
  else refresh()
}

function openDetail(post: Post) {
  selectedPost.value = post
  detailOpen.value = true
}
async function onToggleLike(post: Post) {
  if (!isLoggedIn.value) { openAuthModal(); return }
  // 不能给自己的帖子点赞
  if (post.userId === user.value?.id) {
    message.warning('不能给自己的帖子点赞')
    return
  }
  try {
    const res = await toggleLike(post.id)
    // toggleLike 已同步本地 likedBy；详情弹窗引用同一对象，无需额外处理
    if (!res.liked) {
      // pass-through: 取消点赞
    }
  } catch {
    message.error('操作失败')
  }
}

function startEdit(post: Post) {
  if (!isLoggedIn.value) { openAuthModal(); return }
  editingPost.value = post
  editorOpen.value = true
}

async function onPostUpdated(updated: Post) {
  // 编辑成功后同步本地列表与详情
  if (selectedPost.value?.id === updated.id) {
    selectedPost.value = { ...selectedPost.value, ...updated }
  }
  message.success('已更新')
}

async function onDeletePost(post: Post) {
  try {
    await removePost(post.id)
    if (selectedPost.value?.id === post.id) detailOpen.value = false
    message.success('已删除')
  } catch (err: any) {
    message.error(err?.data?.statusMessage || '删除失败')
  }
}

function startCreate() {
  if (!isLoggedIn.value) { openAuthModal(); return }
  editingPost.value = null
  editorOpen.value = true
}

onMounted(async () => {
  await Promise.all([
    refresh(),
    fetchCollections().catch(() => {}),
    $fetch<{ name: string; postCount: number }[]>('/api/topics').then((t) => { trendingTopics.value = t }).catch(() => {}),
  ])
})

useHead({ title: '社区 · 发现' })
</script>

<template>
  <div class="community-page">
    <!-- 顶部工具栏 -->
    <nav class="toolbar glass-soft">
      <div class="toolbar-left">
        <div class="sort-tabs">
          <button class="sort-btn" :class="{ active: sortMode === 'latest' }" @click="toggleSort('latest')">
            <FireOutlined /> 最新
          </button>
          <button class="sort-btn" :class="{ active: sortMode === 'hot' }" @click="toggleSort('hot')">
            <FireOutlined /> 热门
          </button>
          <button v-if="isLoggedIn" class="sort-btn" :class="{ active: sortMode === 'following' }" @click="toggleSort('following')">
            <FireOutlined /> 关注
          </button>
        </div>
        <div class="tag-bar" v-if="allTags.length && sortMode !== 'following'">
          <button
            class="tag-pill"
            :class="{ active: !activeTag }"
            @click="activeTag = ''; refresh()"
          >全部</button>
          <button
            v-for="t in allTags"
            :key="t"
            class="tag-pill"
            :class="{ active: activeTag === t }"
            @click="applyTag(t)"
          >#{{ t }}</button>
        </div>
      </div>
      <div class="toolbar-right">
        <div class="search-box">
          <SearchOutlined class="search-icon" />
          <input
            v-model="searchInput"
            type="text"
            placeholder="搜索帖子…"
            @keydown.enter="applySearch"
          />
        </div>
        <button class="create-btn" @click="startCreate">
          <PlusOutlined /> 发布
        </button>
      </div>
    </nav>

    <!-- 瀑布流 -->
    <main class="masonry" :class="{ loading }">
      <PostCard
        v-for="post in displayPosts"
        :key="post.id"
        :post="post"
        :current-user-id="user?.id"
        @click="openDetail(post)"
        @toggle-like="onToggleLike(post)"
      />
      <div v-if="!loading && !displayPosts.length" class="empty-state">
        <div class="empty-icon">📝</div>
        <p>这里还没有内容，快来发布第一篇笔记吧！</p>
        <button class="create-btn lg" @click="startCreate"><PlusOutlined /> 立即发布</button>
      </div>
      <div v-if="loading" class="loading-grid">
        <div v-for="i in 6" :key="i" class="skeleton-card" />
      </div>
    </main>

    <!-- 热门话题 -->
    <section v-if="trendingTopics.length" class="topics-section">
      <h2 class="topics-title"><FireOutlined /> 热门话题</h2>
      <div class="topics-scroll">
        <NuxtLink
          v-for="t in trendingTopics.slice(0, 10)"
          :key="t.name"
          :to="`/topic/${encodeURIComponent(t.name)}`"
          class="topic-card glass-soft"
        >
          <img :src="`/api/poster/topic?name=${encodeURIComponent(t.name)}`" :alt="t.name" class="topic-thumb" loading="lazy" />
          <div class="topic-info">
            <span class="topic-name">#{{ t.name }}</span>
            <span class="topic-count">{{ t.postCount }} 篇笔记</span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- 发帖按钮（移动端浮动） -->
    <button class="fab" @click="startCreate" aria-label="发布笔记">
      <PlusOutlined />
    </button>

    <!-- 详情弹窗 -->
    <PostDetailModal
      v-model:open="detailOpen"
      :post="selectedPost"
      @toggle-like="onToggleLike"
      @edit="startEdit"
    />

    <!-- 发帖/编辑弹窗 -->
    <PostEditorModal
      v-model:open="editorOpen"
      :post="editingPost"
      @created="refresh"
      @updated="onPostUpdated"
    />
  </div>
</template>

<style scoped lang="less">
.community-page {
  max-width: 1280px; margin: 0 auto; padding: 16px 20px 40px;
}

.toolbar {
  position: sticky; top: 64px; z-index: 20;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  flex-wrap: wrap; padding: 10px 14px; border-radius: var(--radius-lg);
  margin-bottom: 18px;
}
.toolbar-left { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 220px; }
.sort-tabs { display: flex; gap: 6px; }
.sort-btn {
  display: inline-flex; align-items: center; gap: 4px;
  background: none; border: 1px solid transparent; color: var(--text-secondary);
  padding: 4px 12px; border-radius: var(--radius-full); cursor: pointer; font-size: var(--text-sm);
  transition: all var(--dur-fast);
}
.sort-btn.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.sort-btn:hover:not(.active) { color: var(--text-primary); }

.tag-bar { display: flex; gap: 6px; flex-wrap: wrap; }
.tag-pill {
  background: var(--bg-subtle); border: 1px solid var(--border-color); color: var(--text-secondary);
  padding: 3px 10px; border-radius: var(--radius-full); cursor: pointer; font-size: var(--text-xs);
  transition: all var(--dur-fast);
}
.tag-pill:hover { color: var(--accent); border-color: var(--accent); }
.tag-pill.active { background: var(--accent); color: #fff; border-color: var(--accent); }

.toolbar-right { display: flex; align-items: center; gap: 10px; }
.search-box {
  position: relative; display: flex; align-items: center;
  background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-full);
  padding: 0 12px;
}
.search-box:focus-within { border-color: var(--accent); }
.search-icon { color: var(--text-muted); font-size: 14px; }
.search-box input {
  border: none; background: transparent; outline: none; padding: 7px 6px;
  font-size: var(--text-sm); color: var(--text-primary); width: 160px;
}

.create-btn {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--accent); color: #fff; border: none; border-radius: var(--radius-full);
  padding: 8px 18px; font-size: var(--text-sm); font-weight: 600; cursor: pointer;
  transition: all var(--dur-fast); white-space: nowrap;
}
.create-btn:hover { background: var(--accent-hover); transform: translateY(-1px); }
.create-btn.lg { padding: 12px 28px; font-size: var(--text-md); }

/* ── Masonry ── */
.masonry {
  column-count: 5; column-gap: 16px;
}
@media (max-width: 1200px) { .masonry { column-count: 4; } }
@media (max-width: 900px) { .masonry { column-count: 3; } }
@media (max-width: 600px) { .masonry { column-count: 2; } }

.loading-grid { display: none; }

/* ── Empty / skeleton ── */
.empty-state {
  column-span: all; text-align: center; padding: 60px 20px; color: var(--text-muted);
}
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-state p { margin-bottom: 18px; }

.skeleton-card {
  break-inside: avoid; margin-bottom: 16px; border-radius: var(--radius-lg);
  background: var(--glass-bg-soft); height: 280px;
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 0.9; } }

/* ── FAB ── */
.fab {
  position: fixed; bottom: 28px; right: 28px; z-index: 30;
  width: 56px; height: 56px; border-radius: 50%; border: none;
  background: linear-gradient(135deg, var(--accent), #ec4899);
  color: #fff; font-size: 24px; cursor: pointer;
  box-shadow: var(--shadow-accent);
  display: none; align-items: center; justify-content: center;
  transition: transform var(--dur-fast);
}
.fab:hover { transform: scale(1.08) rotate(90deg); }
@media (max-width: 768px) { .fab { display: flex; } .create-btn:not(.lg) { display: none; } }
.topics-section { margin-top: 32px; }
.topics-title { font-size: var(--text-lg); font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.topics-scroll { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 8px; }
.topic-card { flex-shrink: 0; width: 180px; border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border-color); transition: transform var(--dur-fast); }
.topic-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
.topic-thumb { width: 100%; height: 110px; object-fit: cover; display: block; }
.topic-info { padding: 10px 12px; }
.topic-name { display: block; font-size: var(--text-sm); font-weight: 600; color: var(--accent); }
.topic-count { display: block; font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; }
</style>
