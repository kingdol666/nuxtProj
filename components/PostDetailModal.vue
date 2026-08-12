<script setup lang="ts">
// PostDetailModal.vue — 帖子详情弹窗（小红书风格）
// 含：图片画廊、正文、点赞、收藏（收藏夹选择）、评论树（含回复 / 点赞 / 删除）
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  HeartOutlined,
  HeartFilled,
  StarOutlined,
  StarFilled,
  LeftOutlined,
  RightOutlined,
  SendOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderAddOutlined,
  CloseOutlined,
  PlayCircleFilled,
} from '@ant-design/icons-vue'
import type { Post } from '~/composables/usePosts'
import type { Collection } from '~/composables/useCollections'
import { avatarStyle } from '~/composables/useAvatar'
import { useAuth } from '~/composables/useAuth'
import { useCollections } from '~/composables/useCollections'

interface CommentItem {
  id: string
  contentId: string
  targetType?: 'content' | 'post'
  userId: string
  username: string
  avatarColor: number
  text: string
  parentId: string | null
  likedBy: string[]
  createdAt: number
}

const props = defineProps<{ post: Post | null; open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'toggle-like', post: Post): void
  (e: 'updated'): void
  (e: 'edit', post: Post): void
}>()

const { user, isLoggedIn, openAuthModal } = useAuth()
const { collections, fetchCollections, createCollection, togglePost, isPostSaved } = useCollections()

// ─── Media gallery (images + videos combined) ───
const activeImg = ref(0)
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.ogg', '.ogv'])
// Build a unified media list: [{ type: 'image'|'video', url }]
const mediaList = computed(() => {
  if (!props.post) return []
  const videos = (props.post.videos || []).map((url) => ({ type: 'video' as const, url }))
  const images = (props.post.images || []).map((url) => ({ type: 'image' as const, url }))
  // Videos first, then images (Xiaohongshu pattern: video is the lead)
  return [...videos, ...images]
})
const hasMedia = computed(() => mediaList.value.length > 0)
function isVideo(url: string): boolean {
  const ext = '.' + (url.split('.').pop() || '').toLowerCase()
  return VIDEO_EXTS.has(ext)
}
function prevMedia() {
  if (mediaList.value.length) activeImg.value = (activeImg.value - 1 + mediaList.value.length) % mediaList.value.length
}
function nextMedia() {
  if (mediaList.value.length) activeImg.value = (activeImg.value + 1) % mediaList.value.length
}
function close() {
  emit('update:open', false)
}
// ─── Comments ───
const comments = ref<CommentItem[]>([])
const commentText = ref('')
const replyTo = ref<CommentItem | null>(null)
const replyText = ref('')
const submitting = ref(false)

// Build a nested tree for rendering
const commentTree = computed(() => {
  const topLevel = comments.value.filter((c) => !c.parentId)
  return topLevel.map((c) => ({
    ...c,
    replies: comments.value
      .filter((r) => r.parentId === c.id)
      .sort((a, b) => a.createdAt - b.createdAt),
  }))
})
const commentCount = computed(() => comments.value.filter((c) => !c.parentId).length)

async function loadComments(postId: string) {
  try {
    const data = await $fetch<CommentItem[]>('/api/comments', {
      params: { contentId: postId, targetType: 'post' },
    })
    comments.value = data
  } catch {
    comments.value = []
  }
}

async function submitComment() {
  if (!isLoggedIn.value) { openAuthModal(); return }
  const text = commentText.value.trim()
  if (!text || submitting.value) return
  submitting.value = true
  try {
    const c = await $fetch<CommentItem>('/api/comments', {
      method: 'POST',
      body: { contentId: props.post!.id, targetType: 'post', text },
    })
    comments.value.unshift(c)
    commentText.value = ''
    if (props.post) props.post.commentCount += 1
  } catch (err: any) {
    message.error(err?.data?.statusMessage || '评论失败')
  } finally {
    submitting.value = false
  }
}

function startReply(c: CommentItem) {
  if (!isLoggedIn.value) { openAuthModal(); return }
  replyTo.value = c
  replyText.value = ''
}
function cancelReply() { replyTo.value = null; replyText.value = '' }

async function submitReply() {
  if (!replyTo.value) return
  const text = replyText.value.trim()
  if (!text || submitting.value) return
  submitting.value = true
  try {
    const c = await $fetch<CommentItem>('/api/comments', {
      method: 'POST',
      body: { contentId: props.post!.id, targetType: 'post', text, parentId: replyTo.value.id },
    })
    comments.value.push(c)
    if (props.post) props.post.commentCount += 1
    cancelReply()
  } catch (err: any) {
    message.error(err?.data?.statusMessage || '回复失败')
  } finally {
    submitting.value = false
  }
}

async function likeComment(c: CommentItem) {
  if (!isLoggedIn.value) { openAuthModal(); return }
  try {
    const res = await $fetch<{ liked: boolean; likeCount: number }>(`/api/comments/${c.id}/like`, { method: 'POST' })
    if (res.liked) c.likedBy.push(user.value!.id)
    else c.likedBy = c.likedBy.filter((u) => u !== user.value!.id)
  } catch {
    message.error('操作失败')
  }
}

async function deleteComment(c: CommentItem) {
  try {
    await $fetch(`/api/comments/${c.id}`, { method: 'DELETE' })
    comments.value = comments.value.filter((x) => x.id !== c.id && x.parentId !== c.id)
    if (props.post) props.post.commentCount = Math.max(0, props.post.commentCount - 1)
    message.success('已删除')
  } catch (err: any) {
    message.error(err?.data?.statusMessage || '删除失败')
  }
}

// ─── Collect / save ───
const collectPickerOpen = ref(false)
const newCollectionName = ref('')
const collectLoading = ref(false)

async function openCollectPicker() {
  if (!isLoggedIn.value) { openAuthModal(); return }
  await fetchCollections()
  collectPickerOpen.value = true
}

async function doCollect(collection: Collection) {
  collectLoading.value = true
  try {
    const collected = await togglePost(collection.id, props.post!.id)
    if (props.post) {
      const idx = props.post.collectedBy.indexOf(user.value!.id)
      if (collected && idx === -1) props.post.collectedBy.push(user.value!.id)
      else if (!collected && idx !== -1) props.post.collectedBy.splice(idx, 1)
    }
    message.success(collected ? `已收藏到「${collection.name}」` : '已取消收藏')
    // If removed from the last containing collection, reflect collectedBy
  } catch (err: any) {
    message.error(err?.data?.statusMessage || '操作失败')
  } finally {
    collectLoading.value = false
  }
}

async function createAndCollect() {
  const name = newCollectionName.value.trim()
  if (!name) return
  collectLoading.value = true
  try {
    const c = await createCollection(name)
    await togglePost(c.id, props.post!.id)
    if (props.post) props.post.collectedBy.push(user.value!.id)
    newCollectionName.value = ''
    message.success(`已创建「${name}」并收藏`)
  } catch (err: any) {
    message.error(err?.data?.statusMessage || '创建失败')
  } finally {
    collectLoading.value = false
  }
}
// ─── Like ───
const liked = computed(() => !!(props.post && user.value && props.post.likedBy.includes(user.value.id)))
const likeCount = computed(() => props.post?.likedBy.length ?? 0)
const collected = computed(() => !!(props.post && user.value && isPostSaved(props.post.id)) || !!(props.post && user.value && props.post.collectedBy.includes(user.value.id)))
const isOwnPost = computed(() => !!(props.post && user.value && props.post.userId === user.value.id))

function startEdit() {
  if (!props.post) return
  emit('edit', props.post)
}

function onLike() {
  if (!isLoggedIn.value) { openAuthModal(); return }
  if (isOwnPost.value) {
    message.warning('不能给自己的帖子点赞')
    return
  }
  if (props.post) emit('toggle-like', props.post)
}

// ─── Time formatting ───
function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

function isMine(c: CommentItem) { return user.value?.id === c.userId }

// ─── Lifecycle: load comments + reset gallery when post changes ───
watch(() => [props.post?.id, props.open], ([pid, open]) => {
  if (open && pid) {
    activeImg.value = 0
    loadComments(pid as string)
    replyTo.value = null
  }
}, { immediate: true })

</script>

<template>
  <a-modal
    :open="open"
    @update:open="(v: boolean) => emit('update:open', v)"
    :footer="null"
    :title="null"
    :closable="false"
    :width="920"
    :destroy-on-close="true"
    wrap-class-name="post-detail-modal"
    centered
  >
    <div v-if="post" class="detail">
      <button class="close-btn" @click="close" aria-label="关闭"><CloseOutlined /></button>
      <div class="detail-grid">
        <!-- 左：媒体画廊（图片 + 视频） -->
        <div class="gallery" v-if="hasMedia">
          <div class="gallery-main">
            <!-- Video player -->
            <video
              v-if="mediaList[activeImg]?.type === 'video'"
              :key="mediaList[activeImg].url"
              :src="mediaList[activeImg].url"
              controls
              preload="metadata"
              playsinline
              class="gallery-video"
            />
            <!-- Image -->
            <img
              v-else-if="mediaList[activeImg]?.type === 'image'"
              :key="mediaList[activeImg].url"
              :src="mediaList[activeImg].url"
              :alt="post.title"
            />
            <button v-if="mediaList.length > 1" class="nav-btn prev" @click="prevMedia"><LeftOutlined /></button>
            <button v-if="mediaList.length > 1" class="nav-btn next" @click="nextMedia"><RightOutlined /></button>
            <span v-if="mediaList.length > 1" class="img-index">{{ activeImg + 1 }} / {{ mediaList.length }}</span>
          </div>
          <div v-if="mediaList.length > 1" class="gallery-thumbs">
            <button
              v-for="(m, i) in mediaList"
              :key="i"
              class="thumb"
              :class="{ active: i === activeImg, video: m.type === 'video' }"
              @click="activeImg = i"
            >
              <video v-if="m.type === 'video'" :src="m.url" preload="metadata" muted />
              <img v-else :src="m.url" alt="" />
              <span v-if="m.type === 'video'" class="thumb-play"><PlayCircleFilled /></span>
            </button>
          </div>
        </div>

        <!-- 右：内容 + 评论 -->
        <div class="right-pane">
          <!-- 作者 -->
          <div class="author-bar">
            <span class="avatar" :style="avatarStyle(post.avatarColor)">{{ post.username.charAt(0).toUpperCase() }}</span>
            <div class="author-info">
              <span class="author-name">{{ post.username }}</span>
              <span class="author-time">{{ timeAgo(post.createdAt) }}</span>
            </div>
          </div>

          <!-- 标题 + 正文 -->
          <h2 class="post-title">{{ post.title }}</h2>
          <div class="post-content">{{ post.content }}</div>

          <!-- 标签 -->
          <div v-if="post.tags.length" class="post-tags">
            <span v-for="t in post.tags" :key="t" class="htag">#{{ t }}</span>
          </div>

          <!-- 操作栏 -->
          <div class="action-bar">
            <button
              class="action-btn"
              :class="{ active: liked, disabled: isOwnPost }"
              :disabled="isOwnPost"
              :title="isOwnPost ? '不能给自己的帖子点赞' : (liked ? '取消点赞' : '点赞')"
              @click="onLike"
            >
              <HeartFilled v-if="liked" />
              <HeartOutlined v-else />
              <span>{{ likeCount }}</span>
            </button>
            <button class="action-btn" :class="{ active: collected }" @click="openCollectPicker">
              <StarFilled v-if="collected" />
              <StarOutlined v-else />
              <span>收藏</span>
            </button>
            <button v-if="isOwnPost" class="action-btn" @click="startEdit" title="编辑帖子">
              <EditOutlined />
              <span>编辑</span>
            </button>
          </div>
          <!-- 分隔 -->
          <div class="comments-header">
            共 <strong>{{ commentCount }}</strong> 条评论
          </div>
          <!-- 评论输入 -->
          <div class="comment-form">
            <input
              v-model="commentText"
              class="comment-input"
              type="text"
              maxlength="2000"
              :placeholder="isLoggedIn ? '说点什么…' : '登录后评论'"
              @keydown.enter="submitComment"
            />
            <button class="send-btn" :disabled="!commentText.trim() || submitting" @click="submitComment">
              <SendOutlined />
            </button>
          </div>

          <!-- 评论列表 -->
          <div class="comments-list">
            <div v-for="c in commentTree" :key="c.id" class="comment-item">
              <span class="avatar sm" :style="avatarStyle(c.avatarColor)">{{ c.username.charAt(0).toUpperCase() }}</span>
              <div class="comment-body">
                <div class="comment-meta">
                  <span class="c-name">{{ c.username }}</span>
                  <span class="c-time">{{ timeAgo(c.createdAt) }}</span>
                </div>
                <p class="c-text">{{ c.text }}</p>
                <div class="c-actions">
                  <button class="c-action" :class="{ liked: c.likedBy.includes(user?.id || '') }" @click="likeComment(c)">
                    <HeartOutlined /> {{ c.likedBy.length || '' }}
                  </button>
                  <button class="c-action" @click="startReply(c)">回复</button>
                  <button v-if="isMine(c) || user?.role === 'admin'" class="c-action danger" @click="deleteComment(c)">
                    <DeleteOutlined />
                  </button>
                </div>

                <!-- 回复列表 -->
                <div v-if="c.replies.length" class="replies">
                  <div v-for="r in c.replies" :key="r.id" class="comment-item sm">
                    <span class="avatar xs" :style="avatarStyle(r.avatarColor)">{{ r.username.charAt(0).toUpperCase() }}</span>
                    <div class="comment-body">
                      <div class="comment-meta">
                        <span class="c-name">{{ r.username }}</span>
                        <span class="c-time">{{ timeAgo(r.createdAt) }}</span>
                      </div>
                      <p class="c-text">{{ r.text }}</p>
                      <div class="c-actions">
                        <button class="c-action" :class="{ liked: r.likedBy.includes(user?.id || '') }" @click="likeComment(r)">
                          <HeartOutlined /> {{ r.likedBy.length || '' }}
                        </button>
                        <button class="c-action" @click="startReply(c)">回复</button>
                        <button v-if="isMine(r) || user?.role === 'admin'" class="c-action danger" @click="deleteComment(r)">
                          <DeleteOutlined />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 回复输入框 -->
                <div v-if="replyTo?.id === c.id" class="reply-form">
                  <span class="reply-hint">回复 @{{ c.username }}：</span>
                  <input
                    v-model="replyText"
                    class="comment-input"
                    type="text"
                    maxlength="2000"
                    placeholder="写下你的回复…"
                    @keydown.enter="submitReply"
                    @keydown.esc="cancelReply"
                  />
                  <button class="send-btn" :disabled="!replyText.trim() || submitting" @click="submitReply">
                    <SendOutlined />
                  </button>
                  <button class="send-btn ghost" @click="cancelReply"><CloseOutlined /></button>
                </div>
              </div>
            </div>
            <div v-if="!commentTree.length" class="empty-comments">还没有评论，来抢沙发吧～</div>
          </div>
        </div>
      </div>

      <!-- 收藏夹选择器 -->
      <a-modal
        :open="collectPickerOpen"
        @update:open="(v: boolean) => (collectPickerOpen = v)"
        :footer="null"
        :title="null"
        :closable="false"
        :width="420"
        :destroy-on-close="true"
        centered
        class="collect-picker-modal"
      >
        <div class="collect-picker">
          <header class="cp-head">
            <h3>收藏到收藏夹</h3>
            <button class="close-btn sm" @click="collectPickerOpen = false"><CloseOutlined /></button>
          </header>
          <div class="cp-list">
            <button
              v-for="c in collections"
              :key="c.id"
              class="cp-item"
              :class="{ active: c.postIds.includes(post.id) }"
              :disabled="collectLoading"
              @click="doCollect(c)"
            >
              <StarFilled v-if="c.postIds.includes(post.id)" class="cp-star" />
              <StarOutlined v-else class="cp-star" />
              <div class="cp-info">
                <span class="cp-name">{{ c.name }}</span>
                <span class="cp-count">{{ c.postIds.length }} 篇内容</span>
              </div>
            </button>
            <div v-if="!collections.length" class="cp-empty">还没有收藏夹，创建一个吧</div>
          </div>
          <div class="cp-create">
            <input
              v-model="newCollectionName"
              class="cp-input"
              type="text"
              maxlength="30"
              placeholder="新建收藏夹名称"
              @keydown.enter="createAndCollect"
            />
            <button class="cp-create-btn" :disabled="!newCollectionName.trim() || collectLoading" @click="createAndCollect">
              <FolderAddOutlined /> 创建并收藏
            </button>
          </div>
        </div>
      </a-modal>
    </div>
  </a-modal>
</template>

<style scoped lang="less">
.detail { position: relative; }
.close-btn {
  position: absolute; top: 8px; right: 8px; z-index: 10;
  background: rgba(0,0,0,0.45); color: #fff; border: none; border-radius: 50%;
  width: 34px; height: 34px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all var(--dur-fast);
}
.close-btn:hover { background: rgba(0,0,0,0.7); }
.close-btn.sm { width: 28px; height: 28px; position: static; background: var(--bg-subtle); color: var(--text-secondary); }
.close-btn.sm:hover { background: var(--danger); color: #fff; }

.detail-grid {
  display: grid; grid-template-columns: minmax(0, 1fr) 380px;
  max-height: 82vh; min-height: 520px;
}
@media (max-width: 768px) {
  .detail-grid { grid-template-columns: 1fr; max-height: none; }
}

/* ── Gallery ── */
.gallery {
  background: #000; display: flex; flex-direction: column; border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  overflow: hidden;
}
.gallery-main {
  position: relative; flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0;
}
.gallery-main img, .gallery-main video { max-width: 100%; max-height: 100%; object-fit: contain; }
.gallery-video { width: 100%; height: auto; max-height: 70vh; background: #000; border-radius: var(--radius-md); }
.nav-btn {
  position: absolute; top: 50%; transform: translateY(-50%);
  background: rgba(0,0,0,0.5); color: #fff; border: none; border-radius: 50%;
  width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background var(--dur-fast);
}
.nav-btn:hover { background: rgba(0,0,0,0.8); }
.nav-btn.prev { left: 12px; }
.nav-btn.next { right: 12px; }
.img-index {
  position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.6); color: #fff; font-size: var(--text-xs);
  padding: 3px 12px; border-radius: var(--radius-full);
}
.gallery-thumbs {
  display: flex; gap: 6px; padding: 8px; overflow-x: auto; background: rgba(0,0,0,0.3);
}
.thumb {
  flex-shrink: 0; width: 52px; height: 52px; border-radius: var(--radius-sm); overflow: hidden;
  border: 2px solid transparent; cursor: pointer; background: none; padding: 0; transition: border-color var(--dur-fast);
}
.thumb img, .thumb video { width: 100%; height: 100%; object-fit: cover; }
.thumb.video { position: relative; }
.thumb-play {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  font-size: 18px; color: rgba(255,255,255,0.9); pointer-events: none;
}
.thumb.active { border-color: #fff; }

/* ── Right pane ── */
.right-pane {
  display: flex; flex-direction: column; overflow-y: auto; padding: 18px 20px;
  background: var(--glass-bg-strong); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
}
.author-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.avatar {
  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; font-size: var(--text-sm);
}
.avatar.sm { width: 30px; height: 30px; font-size: 12px; }
.avatar.xs { width: 26px; height: 26px; font-size: 11px; }
.author-info { display: flex; flex-direction: column; }
.author-name { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
.author-time { font-size: var(--text-xs); color: var(--text-muted); }

.post-title { font-size: var(--text-lg); font-weight: 700; color: var(--text-primary); margin: 0 0 8px; line-height: var(--leading-snug); }
.post-content {
  font-size: var(--text-base); color: var(--text-primary); line-height: var(--leading-normal);
  white-space: pre-wrap; word-break: break-word; margin-bottom: 10px;
}
.post-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.htag { font-size: var(--text-xs); color: var(--accent); font-weight: 500; }

.action-bar { display: flex; gap: 10px; padding: 10px 0; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); margin-bottom: 14px; }
.action-btn {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--bg-subtle); border: 1px solid var(--border-color);
  color: var(--text-secondary); border-radius: var(--radius-full);
  padding: 6px 14px; cursor: pointer; font-size: var(--text-sm);
  transition: all var(--dur-fast);
}
.action-btn:hover { border-color: var(--accent); color: var(--accent); }
.action-btn.active { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.action-btn.disabled,
.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.action-btn.disabled:hover,
.action-btn:disabled:hover { border-color: var(--border-color); color: var(--text-secondary); }

.comments-header { font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: 10px; }
.comments-header strong { color: var(--text-primary); }

.comment-form { display: flex; gap: 8px; margin-bottom: 14px; }
.comment-input {
  flex: 1; background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-full);
  padding: 8px 14px; font-size: var(--text-sm); color: var(--text-primary); outline: none;
  transition: border-color var(--dur-fast);
}
.comment-input:focus { border-color: var(--accent); }
.send-btn {
  background: var(--accent); color: #fff; border: none; border-radius: 50%;
  width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all var(--dur-fast);
}
.send-btn:hover:not(:disabled) { background: var(--accent-hover); }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.send-btn.ghost { background: var(--bg-subtle); color: var(--text-secondary); }

.comments-list { display: flex; flex-direction: column; gap: 14px; }
.comment-item { display: flex; gap: 10px; }
.comment-item.sm { gap: 8px; margin-top: 10px; }
.comment-body { flex: 1; min-width: 0; }
.comment-meta { display: flex; align-items: baseline; gap: 8px; }
.c-name { font-size: var(--text-xs); font-weight: 600; color: var(--text-primary); }
.c-time { font-size: 11px; color: var(--text-muted); }
.c-text { font-size: var(--text-sm); color: var(--text-primary); line-height: var(--leading-snug); margin: 2px 0 4px; word-break: break-word; }
.c-actions { display: flex; gap: 12px; align-items: center; }
.c-action {
  background: none; border: none; cursor: pointer; font-size: 11px; color: var(--text-muted);
  display: inline-flex; align-items: center; gap: 3px; padding: 2px 0; transition: color var(--dur-fast);
}
.c-action:hover { color: var(--accent); }
.c-action.liked { color: var(--danger); }
.c-action.danger:hover { color: var(--danger); }
.replies {
  margin-top: 8px; padding: 8px 12px; background: var(--bg-subtle); border-radius: var(--radius-md);
}
.reply-form { display: flex; gap: 6px; align-items: center; margin-top: 8px; }
.reply-hint { font-size: var(--text-xs); color: var(--text-secondary); white-space: nowrap; }
.empty-comments { text-align: center; color: var(--text-muted); font-size: var(--text-sm); padding: 24px 0; }

/* ── Collect picker ── */
.collect-picker { display: flex; flex-direction: column; gap: 14px; padding: 4px; }
.cp-head { display: flex; align-items: center; justify-content: space-between; }
.cp-head h3 { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--text-primary); }
.cp-list { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
.cp-item {
  display: flex; align-items: center; gap: 10px; text-align: left;
  background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md);
  padding: 10px 12px; cursor: pointer; transition: all var(--dur-fast);
}
.cp-item:hover:not(:disabled) { border-color: var(--accent); }
.cp-item.active { border-color: var(--accent); background: var(--accent-soft); }
.cp-item:disabled { opacity: 0.6; cursor: wait; }
.cp-star { font-size: 18px; color: var(--text-muted); }
.cp-item.active .cp-star { color: var(--warning); }
.cp-info { display: flex; flex-direction: column; }
.cp-name { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
.cp-count { font-size: 11px; color: var(--text-muted); }
.cp-empty { text-align: center; color: var(--text-muted); font-size: var(--text-sm); padding: 20px; }
.cp-create { display: flex; gap: 8px; padding-top: 10px; border-top: 1px solid var(--border-color); }
.cp-input {
  flex: 1; background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md);
  padding: 8px 12px; font-size: var(--text-sm); color: var(--text-primary); outline: none;
}
.cp-input:focus { border-color: var(--accent); }
.cp-create-btn {
  display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
  background: var(--accent); color: #fff; border: none; border-radius: var(--radius-md);
  padding: 8px 14px; font-size: var(--text-sm); cursor: pointer; transition: all var(--dur-fast);
}
.cp-create-btn:hover:not(:disabled) { background: var(--accent-hover); }
.cp-create-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
