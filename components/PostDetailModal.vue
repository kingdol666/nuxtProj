<script setup lang="ts">
// PostDetailModal.vue — 帖子详情弹窗（小红书风格 · 精致版）
// 含：自适应图片画廊、正文、点赞、收藏（收藏夹选择）、评论树（含回复 / 点赞 / 删除）
import { ref, computed, watch, nextTick } from 'vue'
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
  ShareAltOutlined,
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
const galleryRef = ref<HTMLElement | null>(null)
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.ogg', '.ogv'])
const mediaList = computed(() => {
  if (!props.post) return []
  const videos = (props.post.videos || []).map((url) => ({ type: 'video' as const, url }))
  const images = (props.post.images || []).map((url) => ({ type: 'image' as const, url }))
  return [...videos, ...images]
})
const hasMedia = computed(() => mediaList.value.length > 0)
function isVideo(url: string): boolean {
  const ext = '.' + (url.split('.').pop() || '').toLowerCase()
  return VIDEO_EXTS.has(ext)
}

// Keyboard navigation
function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'ArrowLeft') prevMedia()
  else if (e.key === 'ArrowRight') nextMedia()
  else if (e.key === 'Escape') close()
}
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKeydown)
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
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

// ─── Like animation ───
const likeAnimating = ref(false)
function triggerLikeAnim() {
  likeAnimating.value = true
  setTimeout(() => { likeAnimating.value = false }, 600)
}

// ─── Comments ───
const comments = ref<CommentItem[]>([])
const commentText = ref('')
const replyTo = ref<CommentItem | null>(null)
const replyText = ref('')
const submitting = ref(false)

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
  if (props.post) {
    emit('toggle-like', props.post)
    triggerLikeAnim()
  }
}

// ─── Share ───
async function sharePost() {
  if (!props.post) return
  const url = `${window.location.origin}/community`
  try {
    if (navigator.share) {
      await navigator.share({ title: props.post.title, url })
    } else {
      await navigator.clipboard.writeText(url)
      message.success('链接已复制')
    }
  } catch { /* user cancelled */ }
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

// ─── Lifecycle ───
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
    :width="1000"
    :destroy-on-close="true"
    wrap-class-name="post-detail-modal"
    centered
  >
    <div v-if="post" class="detail">
      <button class="close-btn" @click="close" aria-label="关闭"><CloseOutlined /></button>
      <div class="detail-grid">
        <!-- ════════ 左：媒体画廊 ════════ -->
        <div class="gallery" :class="{ 'no-media': !hasMedia }" ref="galleryRef">
          <div class="gallery-main" v-if="hasMedia">
            <!-- 媒体计数徽章 -->
            <div v-if="mediaList.length > 1" class="media-counter">
              {{ activeImg + 1 }} / {{ mediaList.length }}
            </div>

            <!-- Video player -->
            <Transition name="gallery-fade" mode="out-in">
              <video
                v-if="mediaList[activeImg]?.type === 'video'"
                :key="mediaList[activeImg].url"
                :src="mediaList[activeImg].url"
                controls
                preload="metadata"
                playsinline
                class="gallery-video"
              />
              <!-- Image — 自适应：object-fit: contain 保证完整显示，无裁切 -->
              <img
                v-else-if="mediaList[activeImg]?.type === 'image'"
                :key="mediaList[activeImg].url"
                :src="mediaList[activeImg].url"
                :alt="post.title"
                class="gallery-image"
              />
            </Transition>

            <!-- 导航 -->
            <template v-if="mediaList.length > 1">
              <button class="nav-btn prev" @click="prevMedia" aria-label="上一张">
                <LeftOutlined />
              </button>
              <button class="nav-btn next" @click="nextMedia" aria-label="下一张">
                <RightOutlined />
              </button>
              <!-- 进度条指示器 -->
              <div class="progress-dots">
                <button
                  v-for="(m, i) in mediaList"
                  :key="i"
                  class="progress-dot"
                  :class="{ active: i === activeImg, video: m.type === 'video' }"
                  @click="activeImg = i"
                  :aria-label="`第 ${i + 1} 张`"
                />
              </div>
            </template>

            <!-- 双击点赞动画 -->
            <Transition name="heart-burst">
              <div v-if="likeAnimating" class="heart-burst-icon">
                <HeartFilled />
              </div>
            </Transition>
          </div>

          <!-- 无媒体时的占位渐变 -->
          <div v-else class="gallery-empty">
            <div class="empty-grad" :style="{ background: `linear-gradient(135deg, hsl(${(post.id.charCodeAt(0) * 37) % 360}, 65%, 55%), hsl(${(post.id.charCodeAt(1) * 53) % 360}, 65%, 45%))` }">
              <span class="empty-title">{{ post.title.charAt(0) }}</span>
            </div>
          </div>
        </div>

        <!-- ════════ 右：内容 + 评论 ════════ -->
        <div class="right-pane">
          <!-- 作者栏 -->
          <header class="author-bar">
            <NuxtLink :to="`/user/${post.userId}`" class="author-link" @click="close">
              <span class="avatar" :style="avatarStyle(post.avatarColor)">{{ post.username.charAt(0).toUpperCase() }}</span>
              <div class="author-info">
                <span class="author-name">{{ post.username }}</span>
                <span class="author-time">{{ timeAgo(post.createdAt) }}</span>
              </div>
            </NuxtLink>
            <button v-if="isOwnPost" class="edit-fab" @click="startEdit" title="编辑帖子">
              <EditOutlined />
            </button>
          </header>

          <!-- 可滚动内容区 -->
          <div class="scroll-area">
            <!-- 标题 -->
            <h2 class="post-title">{{ post.title }}</h2>

            <!-- 正文 -->
            <div class="post-content">{{ post.content }}</div>

            <!-- 标签 -->
            <div v-if="post.tags.length" class="post-tags">
              <NuxtLink
                v-for="t in post.tags"
                :key="t"
                :to="`/topic/${encodeURIComponent(t)}`"
                class="htag"
                @click="close"
              >#{{ t }}</NuxtLink>
            </div>

            <!-- 操作栏 -->
            <div class="action-bar">
              <button
                class="action-btn like-btn"
                :class="{ active: liked, disabled: isOwnPost, bounce: likeAnimating }"
                :disabled="isOwnPost"
                :title="isOwnPost ? '不能给自己的帖子点赞' : (liked ? '取消点赞' : '点赞')"
                @click="onLike"
              >
                <HeartFilled v-if="liked" />
                <HeartOutlined v-else />
                <span class="action-count">{{ likeCount }}</span>
              </button>
              <button class="action-btn" :class="{ active: collected }" @click="openCollectPicker">
                <StarFilled v-if="collected" />
                <StarOutlined v-else />
                <span class="action-label">收藏</span>
              </button>
              <button class="action-btn" @click="sharePost" title="分享">
                <ShareAltOutlined />
              </button>
            </div>

            <!-- 评论区 -->
            <div class="comments-section">
              <div class="comments-header">
                <span class="ch-title">评论</span>
                <span class="ch-count">{{ commentCount }}</span>
              </div>

              <!-- 评论输入 -->
              <div class="comment-form">
                <span v-if="user" class="avatar xs" :style="avatarStyle(user.avatarColor)">{{ user.username.charAt(0).toUpperCase() }}</span>
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
                <TransitionGroup name="comment-pop">
                  <div v-for="c in commentTree" :key="c.id" class="comment-item">
                    <NuxtLink :to="`/user/${c.userId}`" class="avatar sm" :style="avatarStyle(c.avatarColor)" @click="close">{{ c.username.charAt(0).toUpperCase() }}</NuxtLink>
                    <div class="comment-body">
                      <div class="comment-meta">
                        <NuxtLink :to="`/user/${c.userId}`" class="c-name" @click="close">{{ c.username }}</NuxtLink>
                        <span class="c-time">{{ timeAgo(c.createdAt) }}</span>
                      </div>
                      <p class="c-text">{{ c.text }}</p>
                      <div class="c-actions">
                        <button class="c-action" :class="{ liked: c.likedBy.includes(user?.id || '') }" @click="likeComment(c)">
                          <HeartOutlined /> <span v-if="c.likedBy.length">{{ c.likedBy.length }}</span>
                        </button>
                        <button class="c-action" @click="startReply(c)">回复</button>
                        <button v-if="isMine(c) || user?.role === 'admin'" class="c-action danger" @click="deleteComment(c)">
                          <DeleteOutlined />
                        </button>
                      </div>

                      <!-- 回复列表 -->
                      <TransitionGroup v-if="c.replies.length" name="comment-pop" tag="div" class="replies">
                        <div v-for="r in c.replies" :key="r.id" class="comment-item sm">
                          <NuxtLink :to="`/user/${r.userId}`" class="avatar xs" :style="avatarStyle(r.avatarColor)" @click="close">{{ r.username.charAt(0).toUpperCase() }}</NuxtLink>
                          <div class="comment-body">
                            <div class="comment-meta">
                              <NuxtLink :to="`/user/${r.userId}`" class="c-name" @click="close">{{ r.username }}</NuxtLink>
                              <span class="c-time">{{ timeAgo(r.createdAt) }}</span>
                            </div>
                            <p class="c-text">{{ r.text }}</p>
                            <div class="c-actions">
                              <button class="c-action" :class="{ liked: r.likedBy.includes(user?.id || '') }" @click="likeComment(r)">
                                <HeartOutlined /> <span v-if="r.likedBy.length">{{ r.likedBy.length }}</span>
                              </button>
                              <button class="c-action" @click="startReply(c)">回复</button>
                              <button v-if="isMine(r) || user?.role === 'admin'" class="c-action danger" @click="deleteComment(r)">
                                <DeleteOutlined />
                              </button>
                            </div>
                          </div>
                        </div>
                      </TransitionGroup>

                      <!-- 回复输入框 -->
                      <div v-if="replyTo?.id === c.id" class="reply-form">
                        <span class="reply-hint">回复 @{{ c.username }}</span>
                        <input
                          v-model="replyText"
                          class="reply-input"
                          type="text"
                          maxlength="2000"
                          placeholder="写下你的回复…"
                          @keydown.enter="submitReply"
                          @keydown.esc="cancelReply"
                        />
                        <button class="send-btn sm" :disabled="!replyText.trim() || submitting" @click="submitReply">
                          <SendOutlined />
                        </button>
                        <button class="send-btn ghost sm" @click="cancelReply"><CloseOutlined /></button>
                      </div>
                    </div>
                  </div>
                </TransitionGroup>
                <div v-if="!commentTree.length" class="empty-comments">
                  <span class="ec-icon">💬</span>
                  还没有评论，来抢沙发吧
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ════════ 收藏夹选择器 ════════ -->
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

/* ── 关闭按钮 ── */
.close-btn {
  position: absolute; top: 10px; right: 10px; z-index: 100;
  background: rgba(0,0,0,0.5); color: #fff; border: 1px solid rgba(255,255,255,0.15);
  border-radius: 50%; width: 36px; height: 36px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 14px; transition: all var(--dur-fast) var(--ease-out);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.close-btn:hover {
  background: var(--danger); border-color: var(--danger);
  transform: rotate(90deg) scale(1.05);
}
.close-btn.sm {
  width: 28px; height: 28px; position: static;
  background: var(--bg-subtle); color: var(--text-secondary); border: 1px solid var(--border-color);
  backdrop-filter: none;
}
.close-btn.sm:hover { background: var(--danger); color: #fff; border-color: var(--danger); }

/* ── 主网格布局 ── */
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  max-height: 86vh; min-height: 540px;
  border-radius: var(--radius-xl);
  overflow: hidden;
}
@media (max-width: 860px) {
  .detail-grid { grid-template-columns: 1fr; max-height: none; }
}

/* ════════════════════════════════════════
   媒体画廊
   ════════════════════════════════════════ */
.gallery {
  position: relative;
  background: #08080d;
  display: flex; flex-direction: column;
}
.gallery.no-media { min-height: 400px; }

.gallery-main {
  position: relative; flex: 1;
  display: flex; align-items: center; justify-content: center;
  min-height: 0; overflow: hidden;
}

/* 自适应图片：contain 完整显示 + 流体尺寸 */
.gallery-image {
  display: block;
  max-width: 100%; max-height: 100%;
  width: auto; height: auto;
  object-fit: contain;
  user-select: none; -webkit-user-drag: none;
}
.gallery-video {
  width: 100%; height: auto; max-height: 86vh;
  object-fit: contain; background: #000;
}

/* 媒体计数 */
.media-counter {
  position: absolute; top: 14px; left: 14px; z-index: 5;
  background: rgba(0,0,0,0.55); color: rgba(255,255,255,0.95);
  font-size: var(--text-xs); font-weight: 500;
  padding: 4px 14px; border-radius: var(--radius-full);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}

/* 导航按钮 */
.nav-btn {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 5;
  background: rgba(0,0,0,0.4); color: #fff;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 50%; width: 42px; height: 42px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  transition: all var(--dur-fast) var(--ease-out);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  opacity: 0;
}
.gallery-main:hover .nav-btn { opacity: 1; }
.nav-btn:hover {
  background: rgba(0,0,0,0.7);
  transform: translateY(-50%) scale(1.1);
}
.nav-btn.prev { left: 14px; }
.nav-btn.next { right: 14px; }

/* 进度点指示器 */
.progress-dots {
  position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 6px; z-index: 5;
}
.progress-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: rgba(255,255,255,0.35); border: none;
  cursor: pointer; padding: 0;
  transition: all var(--dur-fast) var(--ease-out);
}
.progress-dot.video { border-radius: 2px; }
.progress-dot.active {
  width: 22px; border-radius: var(--radius-full);
  background: #fff;
}
.progress-dot:hover { background: rgba(255,255,255,0.6); }

/* 双击点赞心形动画 */
.heart-burst-icon {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 80px; color: var(--danger);
  filter: drop-shadow(0 4px 20px rgba(239,68,68,0.5));
  z-index: 10; pointer-events: none;
}

/* 无媒体时的渐变占位 */
.gallery-empty {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
}
.empty-grad {
  width: 100%; height: 100%; min-height: 400px;
  display: flex; align-items: center; justify-content: center;
}
.empty-title {
  font-size: 120px; font-weight: 800;
  color: rgba(255,255,255,0.9);
  text-shadow: 0 4px 30px rgba(0,0,0,0.2);
}

/* ── 画廊过渡 ── */
.gallery-fade-enter-active, .gallery-fade-leave-active {
  transition: opacity 0.25s var(--ease-out), transform 0.25s var(--ease-out);
}
.gallery-fade-enter-from { opacity: 0; transform: scale(1.03); }
.gallery-fade-leave-to { opacity: 0; transform: scale(0.97); }

.heart-burst-enter-active { animation: heart-burst 0.6s var(--ease-spring); }
.heart-burst-leave-to { opacity: 0; }
@keyframes heart-burst {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  25% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}

/* ════════════════════════════════════════
   右侧内容面板
   ════════════════════════════════════════ */
.right-pane {
  display: flex; flex-direction: column;
  background: var(--glass-bg-strong);
  backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
  border-left: 1px solid var(--glass-border);
  overflow: hidden;
}

/* ── 作者栏 ── */
.author-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.author-link {
  display: flex; align-items: center; gap: 10px;
  text-decoration: none;
}
.avatar {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: var(--text-sm);
  transition: transform var(--dur-fast) var(--ease-out);
}
.author-link:hover .avatar { transform: scale(1.08); }
.avatar.sm { width: 32px; height: 32px; font-size: 12px; }
.avatar.xs { width: 28px; height: 28px; font-size: 11px; }
.author-info { display: flex; flex-direction: column; }
.author-name {
  font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);
  transition: color var(--dur-fast);
}
.author-link:hover .author-name { color: var(--accent); }
.author-time { font-size: var(--text-xs); color: var(--text-muted); }

.edit-fab {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: var(--radius-sm);
  background: var(--accent-soft); color: var(--accent);
  border: 1px solid transparent; cursor: pointer; font-size: 14px;
  transition: all var(--dur-fast) var(--ease-out);
}
.edit-fab:hover {
  background: var(--accent); color: #fff;
  transform: scale(1.05);
}

/* ── 可滚动内容区 ── */
.scroll-area {
  flex: 1; overflow-y: auto;
  padding: 18px 20px 20px;
  scrollbar-width: thin;
}
.scroll-area::-webkit-scrollbar { width: 5px; }
.scroll-area::-webkit-scrollbar-track { background: transparent; }
.scroll-area::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }

/* ── 标题 ── */
.post-title {
  font-size: var(--text-xl); font-weight: 800; color: var(--text-primary);
  margin: 0 0 10px; line-height: var(--leading-tight);
  letter-spacing: -0.01em;
}

/* ── 正文 ── */
.post-content {
  font-size: var(--text-base); color: var(--text-primary);
  line-height: 1.75; white-space: pre-wrap; word-break: break-word;
  margin-bottom: 14px;
}

/* ── 标签 ── */
.post-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.htag {
  font-size: var(--text-xs); color: var(--accent); font-weight: 600;
  background: var(--accent-soft); padding: 3px 10px;
  border-radius: var(--radius-full); text-decoration: none;
  transition: all var(--dur-fast) var(--ease-out);
}
.htag:hover { background: var(--accent); color: #fff; transform: translateY(-1px); }

/* ── 操作栏 ── */
.action-bar {
  display: flex; gap: 10px; align-items: center;
  padding: 12px 0; margin-bottom: 4px;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
}
.action-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--bg-subtle); border: 1px solid var(--border-color);
  color: var(--text-secondary); border-radius: var(--radius-full);
  padding: 7px 16px; cursor: pointer;
  font-size: var(--text-sm); font-weight: 500;
  transition: all var(--dur-fast) var(--ease-out);
}
.action-btn:hover { border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }
.action-btn.active {
  background: var(--accent-soft); border-color: var(--accent); color: var(--accent);
}
.action-btn.disabled, .action-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.action-btn.disabled:hover, .action-btn:disabled:hover {
  border-color: var(--border-color); color: var(--text-secondary); transform: none;
}

/* 点赞弹跳动画 */
.like-btn.bounce { animation: like-bounce 0.5s var(--ease-spring); }
@keyframes like-bounce {
  0%, 100% { transform: scale(1); }
  30% { transform: scale(1.2); }
  60% { transform: scale(0.95); }
}

/* ════════════════════════════════════════
   评论区
   ════════════════════════════════════════ */
.comments-section { margin-top: 14px; }
.comments-header {
  display: flex; align-items: center; gap: 6px; margin-bottom: 14px;
}
.ch-title { font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); }
.ch-count {
  font-size: var(--text-xs); color: var(--text-muted);
  background: var(--bg-subtle); padding: 1px 8px; border-radius: var(--radius-full);
}

/* 评论输入 */
.comment-form {
  display: flex; gap: 8px; align-items: center; margin-bottom: 16px;
}
.comment-input {
  flex: 1; background: var(--bg-subtle);
  border: 1px solid var(--border-color); border-radius: var(--radius-full);
  padding: 10px 16px; font-size: var(--text-sm); color: var(--text-primary);
  outline: none; transition: all var(--dur-fast);
}
.comment-input::placeholder { color: var(--text-muted); }
.comment-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.send-btn {
  background: var(--accent); color: #fff; border: none;
  border-radius: 50%; width: 38px; height: 38px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 15px;
  transition: all var(--dur-fast) var(--ease-out);
  box-shadow: var(--shadow-xs);
}
.send-btn:hover:not(:disabled) {
  background: var(--accent-hover); transform: scale(1.08);
  box-shadow: var(--shadow-accent);
}
.send-btn:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }
.send-btn.sm { width: 32px; height: 32px; font-size: 13px; }
.send-btn.ghost { background: var(--bg-subtle); color: var(--text-secondary); box-shadow: none; }
.send-btn.ghost:hover { background: var(--danger); color: #fff; }

/* 评论列表 */
.comments-list { display: flex; flex-direction: column; gap: 16px; }
.comment-item { display: flex; gap: 10px; }
.comment-item.sm { gap: 8px; }
.comment-body { flex: 1; min-width: 0; }
.comment-meta { display: flex; align-items: baseline; gap: 8px; }
.c-name {
  font-size: var(--text-xs); font-weight: 700; color: var(--text-primary);
  text-decoration: none;
  transition: color var(--dur-fast);
}
.c-name:hover { color: var(--accent); }
.c-time { font-size: 11px; color: var(--text-muted); }
.c-text {
  font-size: var(--text-sm); color: var(--text-primary);
  line-height: var(--leading-snug); margin: 3px 0 5px;
  word-break: break-word;
}
.c-actions { display: flex; gap: 14px; align-items: center; }
.c-action {
  background: none; border: none; cursor: pointer;
  font-size: 11px; color: var(--text-muted);
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 0; transition: color var(--dur-fast);
}
.c-action:hover { color: var(--accent); }
.c-action.liked { color: var(--danger); }
.c-action.danger:hover { color: var(--danger); }

.replies {
  margin-top: 10px; padding: 10px 14px;
  background: var(--bg-subtle); border-radius: var(--radius-md);
  display: flex; flex-direction: column; gap: 12px;
}
.reply-form {
  display: flex; gap: 6px; align-items: center; margin-top: 10px;
}
.reply-hint { font-size: var(--text-xs); color: var(--accent); white-space: nowrap; font-weight: 600; }
.reply-input {
  flex: 1; background: var(--bg-surface);
  border: 1px solid var(--accent); border-radius: var(--radius-full);
  padding: 7px 14px; font-size: var(--text-xs); color: var(--text-primary);
  outline: none;
}
.reply-input:focus { box-shadow: 0 0 0 3px var(--accent-soft); }

.empty-comments {
  text-align: center; color: var(--text-muted);
  font-size: var(--text-sm); padding: 32px 0;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.ec-icon { font-size: 32px; opacity: 0.5; }

/* 评论入场动画 */
.comment-pop-enter-active { transition: all 0.35s var(--ease-spring); }
.comment-pop-leave-active { transition: all 0.2s var(--ease-out); position: absolute; }
.comment-pop-enter-from { opacity: 0; transform: translateY(12px) scale(0.96); }
.comment-pop-leave-to { opacity: 0; transform: scale(0.96); }

/* ════════════════════════════════════════
   收藏夹选择器
   ════════════════════════════════════════ */
.collect-picker { display: flex; flex-direction: column; gap: 14px; padding: 4px; }
.cp-head { display: flex; align-items: center; justify-content: space-between; }
.cp-head h3 { margin: 0; font-size: var(--text-lg); font-weight: 800; color: var(--text-primary); }
.cp-list {
  display: flex; flex-direction: column; gap: 6px;
  max-height: 280px; overflow-y: auto;
}
.cp-item {
  display: flex; align-items: center; gap: 10px; text-align: left;
  background: var(--bg-subtle); border: 1px solid var(--border-color);
  border-radius: var(--radius-md); padding: 11px 14px;
  cursor: pointer; transition: all var(--dur-fast) var(--ease-out);
}
.cp-item:hover:not(:disabled) {
  border-color: var(--accent); transform: translateX(2px);
}
.cp-item.active { border-color: var(--accent); background: var(--accent-soft); }
.cp-item:disabled { opacity: 0.6; cursor: wait; }
.cp-star { font-size: 18px; color: var(--text-muted); transition: color var(--dur-fast); }
.cp-item.active .cp-star { color: var(--warning); }
.cp-info { display: flex; flex-direction: column; }
.cp-name { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
.cp-count { font-size: 11px; color: var(--text-muted); }
.cp-empty { text-align: center; color: var(--text-muted); font-size: var(--text-sm); padding: 24px; }
.cp-create {
  display: flex; gap: 8px; padding-top: 12px;
  border-top: 1px solid var(--border-color);
}
.cp-input {
  flex: 1; background: var(--bg-subtle);
  border: 1px solid var(--border-color); border-radius: var(--radius-md);
  padding: 9px 12px; font-size: var(--text-sm); color: var(--text-primary);
  outline: none; transition: border-color var(--dur-fast);
}
.cp-input:focus { border-color: var(--accent); }
.cp-create-btn {
  display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
  background: var(--accent); color: #fff; border: none;
  border-radius: var(--radius-md); padding: 9px 16px;
  font-size: var(--text-sm); font-weight: 600; cursor: pointer;
  transition: all var(--dur-fast);
}
.cp-create-btn:hover:not(:disabled) {
  background: var(--accent-hover); transform: translateY(-1px);
}
.cp-create-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
