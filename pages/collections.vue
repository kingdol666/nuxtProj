<script setup lang="ts">
// pages/collections.vue — 收藏夹页面
import { ref, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  StarOutlined,
  FolderAddOutlined,
  DeleteOutlined,
  BookOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons-vue'
import { useCollections, type Collection } from '~/composables/useCollections'
import { usePosts, type Post } from '~/composables/usePosts'
import { useAuth } from '~/composables/useAuth'

const { collections, loading, fetchCollections, createCollection, removeCollection } = useCollections()
const { fetchPosts } = usePosts()
const { user, isLoggedIn, openAuthModal } = useAuth()

// 创建收藏夹
const createOpen = ref(false)
const newName = ref('')
const newDesc = ref('')
const creating = ref(false)

async function doCreate() {
  const name = newName.value.trim()
  if (!name) return
  creating.value = true
  try {
    await createCollection(name, newDesc.value.trim())
    newName.value = ''
    newDesc.value = ''
    createOpen.value = false
    message.success('收藏夹已创建')
  } catch (err: any) {
    message.error(err?.data?.statusMessage || '创建失败')
  } finally {
    creating.value = false
  }
}

async function doDelete(c: Collection) {
  try {
    await removeCollection(c.id)
    // If viewing this collection, go back to list
    if (activeCollection.value?.id === c.id) activeCollection.value = null
    message.success('已删除收藏夹')
  } catch (err: any) {
    message.error(err?.data?.statusMessage || '删除失败')
  }
}

// 查看某个收藏夹内的帖子
const activeCollection = ref<Collection | null>(null)
const collectedPosts = ref<Post[]>([])
const postsLoading = ref(false)

const selectedPost = ref<Post | null>(null)
const detailOpen = ref(false)

async function viewCollection(c: Collection) {
  activeCollection.value = c
  if (!c.postIds.length) { collectedPosts.value = []; return }
  postsLoading.value = true
  try {
    // Fetch all posts then filter to this collection's
    const all = await $fetch<Post[]>('/api/posts')
    collectedPosts.value = all.filter((p) => c.postIds.includes(p.id))
  } catch {
    collectedPosts.value = []
  } finally {
    postsLoading.value = false
  }
}

function backToList() { activeCollection.value = null; collectedPosts.value = [] }

function openDetail(post: Post) { selectedPost.value = post; detailOpen.value = true }

async function onToggleLike(post: Post) {
  if (!isLoggedIn.value) { openAuthModal(); return }
  if (post.userId === user.value?.id) { message.warning('不能给自己的帖子点赞'); return }
  try {
    const res = await $fetch<{ liked: boolean }>(`/api/posts/${post.id}/like`, { method: 'POST' })
    const uid = user.value?.id
    if (uid) {
      if (res.liked) { if (!post.likedBy.includes(uid)) post.likedBy.push(uid) }
      else { post.likedBy = post.likedBy.filter((u) => u !== uid) }
    }
  } catch {
    message.error('操作失败')
  }
}

function startCreate() {
  if (!isLoggedIn.value) { openAuthModal(); return }
  createOpen.value = true
}

const totalSaved = computed(() => collections.value.reduce((s, c) => s + c.postIds.length, 0))

onMounted(() => { if (isLoggedIn.value) fetchCollections().catch(() => {}) })
watch(isLoggedIn, (v) => { if (v) fetchCollections().catch(() => {}) })

useHead({ title: '我的收藏' })
</script>

<template>
  <div class="collections-page">
    <!-- 未登录提示 -->
    <div v-if="!isLoggedIn" class="auth-prompt glass">
      <BookOutlined class="prompt-icon" />
      <h2>登录后查看你的收藏夹</h2>
      <p>把你喜欢的笔记、应用都收藏起来，随时回看。</p>
      <button class="primary-btn" @click="openAuthModal">去登录</button>
    </div>

    <template v-else>
      <!-- 收藏夹列表视图 -->
      <template v-if="!activeCollection">
        <header class="page-head">
          <div class="head-left">
            <h1>我的收藏</h1>
            <span class="head-stat">{{ collections.length }} 个收藏夹 · 共 {{ totalSaved }} 篇内容</span>
          </div>
          <button class="primary-btn" @click="startCreate">
            <FolderAddOutlined /> 新建收藏夹
          </button>
        </header>

        <div v-if="loading" class="loading-text">加载中…</div>

        <div v-else-if="collections.length" class="collection-grid">
          <div
            v-for="c in collections"
            :key="c.id"
            class="collection-card"
            @click="viewCollection(c)"
          >
            <div class="cc-cover" :data-count="c.postIds.length">
              <BookOutlined class="cc-icon" />
              <span class="cc-badge">{{ c.postIds.length }}</span>
            </div>
            <div class="cc-body">
              <h3 class="cc-name">{{ c.name }}</h3>
              <p v-if="c.description" class="cc-desc">{{ c.description }}</p>
              <div class="cc-foot">
                <span>{{ c.postIds.length }} 篇内容</span>
                <button class="cc-del" @click.stop="doDelete(c)" aria-label="删除收藏夹">
                  <DeleteOutlined />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state glass-soft">
          <div class="empty-icon">📚</div>
          <h3>还没有收藏夹</h3>
          <p>创建一个收藏夹，把喜欢的笔记都整理起来吧</p>
          <button class="primary-btn lg" @click="startCreate"><FolderAddOutlined /> 创建收藏夹</button>
        </div>
      </template>

      <!-- 单个收藏夹内的帖子视图 -->
      <template v-else>
        <header class="page-head">
          <div class="head-left">
            <button class="back-btn" @click="backToList"><ArrowLeftOutlined /> 返回</button>
            <h1>{{ activeCollection.name }}</h1>
          </div>
        </header>
        <p v-if="activeCollection.description" class="coll-desc">{{ activeCollection.description }}</p>
        <div v-if="postsLoading" class="loading-text">加载中…</div>
        <div v-else-if="collectedPosts.length" class="masonry">
          <PostCard
            v-for="post in collectedPosts"
            :key="post.id"
            :post="post"
            :current-user-id="user?.id"
            @click="openDetail(post)"
            @toggle-like="onToggleLike(post)"
          />
        </div>
        <div v-else class="empty-state glass-soft">
          <div class="empty-icon">📭</div>
          <h3>这个收藏夹还是空的</h3>
          <p>去社区发现更多感兴趣的笔记吧</p>
          <NuxtLink to="/community" class="primary-btn lg">逛逛社区</NuxtLink>
        </div>
      </template>
    </template>

    <!-- 创建收藏夹弹窗 -->
    <a-modal
      :open="createOpen"
      @update:open="(v: boolean) => (createOpen = v)"
      :footer="null"
      title="新建收藏夹"
      :width="420"
      centered
      :destroy-on-close="true"
    >
      <div class="create-form">
        <div class="form-field">
          <label>名称</label>
          <input v-model="newName" type="text" maxlength="30" placeholder="给收藏夹起个名字" />
        </div>
        <div class="form-field">
          <label>描述（可选）</label>
          <textarea v-model="newDesc" rows="3" maxlength="100" placeholder="简单描述一下…" />
        </div>
        <div class="form-actions">
          <button class="cancel-btn" @click="createOpen = false">取消</button>
          <button class="primary-btn" :disabled="!newName.trim() || creating" @click="doCreate">
            {{ creating ? '创建中…' : '创建' }}
          </button>
        </div>
      </div>
    </a-modal>

    <!-- 详情弹窗 -->
    <PostDetailModal v-model:open="detailOpen" :post="selectedPost" @toggle-like="onToggleLike" />
  </div>
</template>

<style scoped lang="less">
.collections-page { max-width: 1200px; margin: 0 auto; padding: 24px 20px 60px; min-height: 60vh; }

.auth-prompt {
  text-align: center; padding: 60px 24px; border-radius: var(--radius-xl); margin-top: 40px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.prompt-icon { font-size: 48px; color: var(--accent); margin-bottom: 8px; }
.auth-prompt h2 { margin: 0; color: var(--text-primary); }
.auth-prompt p { color: var(--text-secondary); margin: 0 0 16px; }

.page-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-bottom: 20px; flex-wrap: wrap;
}
.head-left { display: flex; flex-direction: column; gap: 4px; }
.page-head h1 { margin: 0; font-size: var(--text-2xl); color: var(--text-primary); font-weight: 700; }
.head-stat { font-size: var(--text-sm); color: var(--text-secondary); }
.back-btn {
  display: inline-flex; align-items: center; gap: 4px; background: none; border: none;
  color: var(--accent); cursor: pointer; font-size: var(--text-sm); padding: 0;
}
.back-btn:hover { color: var(--accent-hover); }
.coll-desc { color: var(--text-secondary); font-size: var(--text-sm); margin: -12px 0 20px; }

.primary-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--accent); color: #fff; border: none; border-radius: var(--radius-full);
  padding: 9px 20px; font-size: var(--text-sm); font-weight: 600; cursor: pointer;
  transition: all var(--dur-fast);
}
.primary-btn:hover:not(:disabled) { background: var(--accent-hover); transform: translateY(-1px); }
.primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.primary-btn.lg { padding: 12px 28px; font-size: var(--text-md); }
.cancel-btn {
  background: var(--bg-subtle); color: var(--text-secondary); border: 1px solid var(--border-color);
  border-radius: var(--radius-full); padding: 9px 20px; cursor: pointer; font-size: var(--text-sm);
  transition: all var(--dur-fast);
}
.cancel-btn:hover { color: var(--text-primary); }

.loading-text { text-align: center; padding: 40px; color: var(--text-muted); }

/* ── Collection cards ── */
.collection-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px;
}
.collection-card {
  border-radius: var(--radius-lg); overflow: hidden; cursor: pointer;
  background: var(--glass-bg-strong); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border); box-shadow: var(--shadow-sm);
  transition: transform var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out);
}
.collection-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
.cc-cover {
  position: relative; aspect-ratio: 4 / 3;
  background: linear-gradient(135deg, var(--accent-soft), rgba(236, 72, 153, 0.15));
  display: flex; align-items: center; justify-content: center;
}
.cc-icon { font-size: 42px; color: var(--accent); opacity: 0.7; }
.cc-badge {
  position: absolute; top: 10px; right: 10px;
  background: var(--glass-bg-strong); color: var(--text-primary);
  font-size: var(--text-xs); font-weight: 600; padding: 3px 10px; border-radius: var(--radius-full);
}
.cc-body { padding: 12px 14px; }
.cc-name { margin: 0 0 4px; font-size: var(--text-md); font-weight: 600; color: var(--text-primary); }
.cc-desc {
  margin: 0 0 8px; font-size: var(--text-xs); color: var(--text-secondary);
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.cc-foot {
  display: flex; align-items: center; justify-content: space-between;
  font-size: var(--text-xs); color: var(--text-muted);
}
.cc-del {
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  padding: 4px; border-radius: var(--radius-sm); transition: all var(--dur-fast);
}
.cc-del:hover { color: var(--danger); background: rgba(239, 68, 68, 0.1); }

/* ── Empty ── */
.empty-state {
  text-align: center; padding: 60px 24px; border-radius: var(--radius-xl); margin-top: 30px;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.empty-icon { font-size: 48px; margin-bottom: 8px; }
.empty-state h3 { margin: 0; color: var(--text-primary); }
.empty-state p { color: var(--text-secondary); margin: 0 0 16px; }

/* ── Masonry (reused) ── */
.masonry { column-count: 4; column-gap: 16px; }
@media (max-width: 1000px) { .masonry { column-count: 3; } }
@media (max-width: 700px) { .masonry { column-count: 2; } }

/* ── Create form ── */
.create-form { display: flex; flex-direction: column; gap: 14px; padding: 4px; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field label { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
.form-field input, .form-field textarea {
  background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md);
  padding: 10px 12px; font-size: var(--text-sm); color: var(--text-primary); outline: none;
  font-family: var(--font-sans); transition: border-color var(--dur-fast); resize: vertical;
}
.form-field input:focus, .form-field textarea:focus { border-color: var(--accent); }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
