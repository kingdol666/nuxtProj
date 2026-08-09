<script setup lang="ts">
// 内容详情 Modal —— 小红书 explore 风格的双栏详情卡片。
//
// 设计要点：
// - 双栏布局：左侧视觉面板（渐变 + 大图标），右侧可滚动内容（标题/评分/描述/
//   标签/操作栏/评论）。移动端自动堆叠为单列。
// - 操作栏：点赞（localStorage 持久化）、收藏、分享（复制链接）、访问外链。
//   点赞/收藏带过渡动效（爆裂缩放），分享给出 toast 反馈。
// - 评论：本地态，可新增；用 item.id 派生稳定的种子评论，让每条内容都有内容感。
// - SSR 安全：open 初始 false，仅客户端渲染弹层；Esc / 背景点击关闭；打开时锁滚动。
// - 主题感知：随 isDark 切换玻璃/调色板。
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { useTheme } from '~/composables/useTheme'
import {
  CloseOutlined,
  FileTextOutlined,
  StarFilled,
  StarOutlined,
  HeartFilled,
  HeartOutlined,
  SaveFilled,
  SaveOutlined,
  ShareAltOutlined,
  ArrowUpOutlined,
  MessageOutlined,
  UserOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons-vue'

interface ContentItem {
  id?: string
  category: string
  category_zh: string
  subCategory: string
  subCategory_zh: string
  name: string
  name_zh: string
  content: string
  content_zh: string
  detail: string
  detail_zh: string
  url: string
  rating: number
}

const props = defineProps<{
  modelValue: boolean
  item: ContentItem | null
}>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
const { themeMode } = useTheme()
const isDark = computed(() => themeMode.value === 'dark')

// ─────────────────────────── 工具 ───────────────────────────
function getHostname(u?: string) {
  if (!u) return ''
  try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u }
}
function getFaviconUrl(u?: string) {
  if (!u) return ''
  try { return `https://unavatar.io/${new URL(u).hostname}?fallback=false` } catch { return '' }
}
// 从 id 派生稳定伪随机数（同一内容每次打开一致）
function seededRand(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967296
}

// ─────────────────────────── 视觉：渐变方案 ───────────────────────────
const gradients = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#06b6d4,#3b82f6)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#10b981,#06b6d4)',
  'linear-gradient(135deg,#3b82f6,#6366f1)',
]
const heroGrad = computed(() => {
  const id = props.item?.id || props.item?.name || '0'
  return gradients[Math.floor(seededRand(id) * gradients.length) % gradients.length]
})
const initial = computed(() => (props.item?.name || '?').charAt(0).toUpperCase())
const baseLikes = computed(() => {
  const id = props.item?.id || '0'
  return Math.floor(seededRand(id + 'like') * 2400) + 80
})

// ─────────────────────────── 点赞 / 收藏 ───────────────────────────
const liked = ref(false)
const saved = ref(false)
const likeBurst = ref(false)
const likes = computed(() => baseLikes.value + (liked.value ? 1 : 0))

const LS_KEY = 'content-detail-state'
function loadPersisted() {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    const id = props.item?.id
    if (id && raw[id]) { liked.value = !!raw[id].liked; saved.value = !!raw[id].saved }
    else { liked.value = false; saved.value = false }
  } catch { /* ignore */ }
}
function persist() {
  if (typeof localStorage === 'undefined' || !props.item?.id) return
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    raw[props.item.id] = { liked: liked.value, saved: saved.value }
    localStorage.setItem(LS_KEY, JSON.stringify(raw))
  } catch { /* ignore */ }
}
function toggleLike() {
  liked.value = !liked.value
  if (liked.value) {
    likeBurst.value = true
    setTimeout(() => { likeBurst.value = false }, 420)
  }
  persist()
}
function toggleSave() { saved.value = !saved.value; persist() }

// ─────────────────────────── 分享 ───────────────────────────
const toast = ref('')
let toastTimer: any = null
function flashToast(t: string) {
  toast.value = t
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2200)
}
async function share() {
  const url = props.item?.url
  if (!url) { flashToast('暂无链接可分享'); return }
  try {
    await navigator.clipboard.writeText(url)
    flashToast('链接已复制到剪贴板')
  } catch {
    flashToast('复制失败，请手动复制')
  }
}

// ─────────────────────────── 评论 ───────────────────────────
interface Comment { id: number; author: string; date: string; text: string }
const seedAuthors = ['设计师小李', '效率工具控', '夜猫子程序员', '产品经理', 'UX研究员', '极简主义者']
const seedTexts = [
  '用了大半年，确实是同类里最好用的之一。',
  '界面很干净，上手几乎没有门槛。',
  '免费版功能已经够日常用了，推荐试试。',
  '协作功能是亮点，团队里都在用。',
  '性能不错，大文件也不卡。',
  '生态丰富，插件基本满足所有需求。',
]
const comments = ref<Comment[]>([])
function buildSeedComments() {
  const id = props.item?.id || '0'
  const n = 2 + Math.floor(seededRand(id + 'c') * 3) // 2~4 条
  const arr: Comment[] = []
  for (let i = 0; i < n; i++) {
    arr.push({
      id: i + 1,
      author: seedAuthors[Math.floor(seededRand(id + 'a' + i) * seedAuthors.length)],
      date: ['刚刚', '1小时前', '3小时前', '昨天', '2天前'][i % 5],
      text: seedTexts[Math.floor(seededRand(id + 't' + i) * seedTexts.length)],
    })
  }
  comments.value = arr
}
const newComment = ref('')
function addComment() {
  const t = newComment.value.trim()
  if (!t) return
  comments.value.unshift({ id: Date.now(), author: '访客', date: '刚刚', text: t })
  newComment.value = ''
}

// ─────────────────────────── 打开/关闭 ───────────────────────────
function close() { open.value = false }
function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape' && open.value) close() }

watch(open, async (v) => {
  if (typeof document === 'undefined') return
  if (v) {
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
    loadPersisted()
    buildSeedComments()
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})

// 切换不同内容时重置交互态
watch(() => props.item?.id, () => {
  if (open.value) { loadPersisted(); buildSeedComments() }
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
  clearTimeout(toastTimer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="detail-fade">
      <div v-if="open && item" class="detail-overlay" :class="{ dark: isDark }" @click.self="close">
        <Transition name="detail-pop" appear>
          <div v-if="open && item" class="detail-card" role="dialog" aria-modal="true">
            <!-- 关闭按钮 -->
            <button class="detail-close" aria-label="关闭" @click="close">
              <CloseOutlined />
            </button>

            <div class="detail-grid">
              <!-- ============ 左：视觉面板 ============ -->
              <aside class="detail-visual" :style="{ '--grad': heroGrad }">
                <div class="visual-aurora" />
                <div class="visual-blob blob-1" />
                <div class="visual-blob blob-2" />
                <div class="visual-content">
                  <div class="visual-appicon">
                    <img
                      v-if="getFaviconUrl(item.url)"
                      :src="getFaviconUrl(item.url)"
                      :alt="item.name"
                      class="visual-favicon"
                      @error="($event.target as HTMLImageElement).style.display='none'"
                    />
                    <span v-else class="visual-letter">{{ initial }}</span>
                  </div>
                  <div class="visual-label">{{ item.category_zh || item.category }}</div>
                  <div class="visual-name">{{ item.name }}</div>
                </div>
                <div class="visual-bottom">
                  <span class="visual-host"><EnvironmentOutlined /> {{ getHostname(item.url) || '—' }}</span>
                </div>
              </aside>

              <!-- ============ 右：内容区 ============ -->
              <section class="detail-body">
                <div class="body-scroll">
                  <!-- 标签行 -->
                  <div class="detail-tags">
                    <span class="chip chip-cat">{{ item.category_zh || item.category }}</span>
                    <span class="chip chip-sub">{{ item.subCategory_zh || item.subCategory }}</span>
                  </div>

                  <!-- 标题 -->
                  <h2 class="detail-title">{{ item.name_zh || item.name }}</h2>
                  <p v-if="item.name_zh && item.name !== item.name_zh" class="detail-enname">{{ item.name }}</p>

                  <!-- 评分 -->
                  <div class="detail-rating">
                    <span class="stars">
                      <component
                        v-for="i in 5"
                        :key="i"
                        :is="i <= (item.rating || 0) ? StarFilled : StarOutlined"
                        class="star"
                        :class="{ on: i <= (item.rating || 0) }"
                      />
                    </span>
                    <span class="rating-num">{{ item.rating || 0 }}.0</span>
                    <span class="rating-label">评分</span>
                  </div>

                  <!-- 简介 -->
                  <div class="detail-desc">
                    <p class="desc-zh">{{ item.content_zh || item.content || '暂无简介' }}</p>
                    <p v-if="item.content && item.content_zh && item.content !== item.content_zh" class="desc-en">{{ item.content }}</p>
                  </div>

                  <!-- 详细介绍 -->
                  <div v-if="(item.detail_zh || item.detail)" class="detail-full">
                    <div class="full-head"><FileTextOutlined /> 详细介绍</div>
                    <p class="full-zh">{{ item.detail_zh || item.detail }}</p>
                    <p v-if="item.detail && item.detail_zh && item.detail !== item.detail_zh" class="full-en">{{ item.detail }}</p>
                  </div>

                  <!-- 链接 -->
                  <a
                    v-if="item.url"
                    :href="item.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="detail-link"
                  >
                    <LinkOutlined /> {{ item.url }}
                  </a>

                  <!-- 评论区 -->
                  <div class="detail-comments">
                    <div class="comments-head">
                      <MessageOutlined /> <span>评论 {{ comments.length }}</span>
                    </div>

                    <div class="comment-form">
                      <span class="comment-avatar"><UserOutlined /></span>
                      <input
                        v-model="newComment"
                        type="text"
                        placeholder="说点什么…"
                        @keydown.enter="addComment"
                      />
                      <button :disabled="!newComment.trim()" @click="addComment">发布</button>
                    </div>

                    <TransitionGroup name="comment" tag="div" class="comment-list">
                      <div v-for="c in comments" :key="c.id" class="comment-item">
                        <span class="comment-avatar"><UserOutlined /></span>
                        <div class="comment-main">
                          <div class="comment-meta">
                            <span class="comment-author">{{ c.author }}</span>
                            <span class="comment-date">{{ c.date }}</span>
                          </div>
                          <p class="comment-text">{{ c.text }}</p>
                        </div>
                      </div>
                    </TransitionGroup>
                  </div>
                </div>

                <!-- 底部操作栏（sticky） -->
                <div class="detail-actions">
                  <button class="action-btn like-btn" :class="{ active: liked, burst: likeBurst }" @click="toggleLike">
                    <component :is="liked ? HeartFilled : HeartOutlined" />
                    <span>{{ likes }}</span>
                  </button>
                  <button class="action-btn" :class="{ active: saved }" @click="toggleSave">
                    <component :is="saved ? SaveFilled : SaveOutlined" />
                    <span>{{ saved ? '已收藏' : '收藏' }}</span>
                  </button>
                  <button class="action-btn" @click="share">
                    <ShareAltOutlined />
                    <span>分享</span>
                  </button>
                  <a
                    v-if="item.url"
                    :href="item.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="action-visit"
                  >
                    访问应用 <ArrowUpOutlined />
                  </a>
                </div>
              </section>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- toast -->
    <Transition name="toast">
      <div v-if="toast" class="detail-toast">{{ toast }}</div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="less">
/* ============ 遮罩 ============ */
.detail-overlay {
  position: fixed; inset: 0; z-index: 1200;
  display: grid; place-items: center;
  padding: 24px;
  background: rgba(10, 10, 18, 0.62);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.detail-overlay.dark { background: rgba(4, 4, 10, 0.74); }

/* ============ 卡片 ============ */
.detail-card {
  position: relative;
  width: 100%; max-width: 960px;
  max-height: calc(100vh - 48px);
  display: flex;
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: var(--glass-bg-strong);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-lg), inset 0 1px 0 var(--glass-highlight);
}

.detail-close {
  position: absolute; top: 12px; right: 12px; z-index: 20;
  display: grid; place-items: center;
  width: 36px; height: 36px;
  border: none; border-radius: 50%;
  background: rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(8px);
  color: #fff; font-size: 16px; cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
  &:hover { background: rgba(0, 0, 0, 0.5); transform: rotate(90deg); }
}

.detail-grid {
  display: grid;
  grid-template-columns: 42% 58%;
  width: 100%;
}

/* ============ 左：视觉面板 ============ */
.detail-visual {
  position: relative;
  background: var(--grad);
  overflow: hidden;
  min-height: 420px;
  display: flex; flex-direction: column;
}
.visual-aurora {
  position: absolute; inset: -20%;
  background: radial-gradient(circle at 30% 25%, rgba(255,255,255,0.28), transparent 55%),
              radial-gradient(circle at 75% 75%, rgba(0,0,0,0.22), transparent 55%);
  pointer-events: none;
}
.visual-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.5;
  pointer-events: none;
}
.blob-1 { width: 220px; height: 220px; background: rgba(255,255,255,0.3); top: -40px; right: -30px; animation: blob-float 9s ease-in-out infinite; }
.blob-2 { width: 180px; height: 180px; background: rgba(0,0,0,0.2); bottom: 30px; left: -40px; animation: blob-float 11s ease-in-out infinite reverse; }
@keyframes blob-float { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(14px,-18px) scale(1.08); } }

.visual-content {
  position: relative; z-index: 2;
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px;
  padding: 40px 24px;
  text-align: center;
}
.visual-appicon {
  width: 108px; height: 108px;
  border-radius: 28px;
  display: grid; place-items: center;
  background: rgba(255,255,255,0.95);
  box-shadow: 0 18px 48px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.5);
  overflow: hidden;
}
.visual-favicon { width: 64%; height: 64%; object-fit: contain; }
.visual-letter {
  font-size: 54px; font-weight: 800;
  color: #6366f1;
  font-family: var(--font-display);
}
.visual-label {
  font-size: var(--text-sm); font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255,255,255,0.85);
  padding: 4px 14px;
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.25);
  border-radius: var(--radius-full);
}
.visual-name {
  font-family: var(--font-display);
  font-size: 26px; font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 16px rgba(0,0,0,0.3);
  letter-spacing: -0.01em;
  word-break: break-word;
}
.visual-bottom {
  position: relative; z-index: 2;
  padding: 16px 22px;
}
.visual-host {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.8);
  font-variant-numeric: tabular-nums;
}

/* ============ 右：内容区 ============ */
.detail-body {
  display: flex; flex-direction: column;
  min-width: 0;
  background: transparent;
  max-height: calc(100vh - 48px);
}
.body-scroll {
  flex: 1; min-height: 0;
  overflow-y: auto;
  padding: 28px 30px 8px;
}

.detail-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.chip {
  font-size: var(--text-xs); font-weight: 600;
  padding: 4px 12px; border-radius: var(--radius-full);
}
.chip-cat { color: var(--accent); background: var(--accent-soft); }
.chip-sub { color: var(--text-secondary); background: var(--glass-bg-soft); border: 1px solid var(--glass-border-inset); }

.detail-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 26px; font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  line-height: 1.25;
}
.detail-enname {
  margin: 4px 0 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.detail-rating {
  display: flex; align-items: center; gap: 8px;
  margin: 16px 0 18px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border-inset);
}
.stars { display: inline-flex; gap: 2px; }
.star { font-size: 16px; color: var(--text-muted); }
.star.on { color: #fadb14; }
.rating-num { font-weight: 800; font-size: var(--text-md); color: var(--text-primary); font-variant-numeric: tabular-nums; }
.rating-label { font-size: var(--text-xs); color: var(--text-muted); }

.detail-desc { margin-bottom: 18px; }
.desc-zh {
  margin: 0;
  font-size: var(--text-base);
  line-height: 1.75;
  color: var(--text-primary);
  white-space: pre-wrap;
}
.desc-en {
  margin: 12px 0 0;
  font-size: var(--text-sm);
  line-height: 1.65;
  color: var(--text-muted);
  padding-left: 12px;
  border-left: 2px solid var(--glass-border-inset);
}

/* 详细介绍 */
.detail-full { margin-bottom: 18px; }
.full-head {
  display: inline-flex; align-items: center; gap: 7px;
  font-weight: 700; font-size: var(--text-sm);
  color: var(--text-primary);
  margin-bottom: 10px;
  :deep(.anticon) { color: var(--accent); }
}
.full-zh {
  margin: 0;
  font-size: var(--text-base);
  line-height: 1.85;
  color: var(--text-secondary);
  white-space: pre-wrap;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border-inset);
}
.full-en {
  margin: 10px 0 0;
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--text-muted);
  white-space: pre-wrap;
}

.detail-link {
  display: inline-flex; align-items: center; gap: 6px;
  max-width: 100%;
  margin-bottom: 22px;
  font-size: var(--text-sm);
  color: var(--accent);
  text-decoration: none;
  word-break: break-all;
  transition: color var(--dur-fast) var(--ease-out);
  :deep(.anticon) { flex-shrink: 0; }
  &:hover { color: var(--accent-hover); }
}

/* ============ 评论区 ============ */
.detail-comments {
  border-top: 1px solid var(--glass-border-inset);
  padding-top: 18px;
  margin-top: 4px;
}
.comments-head {
  display: inline-flex; align-items: center; gap: 7px;
  font-weight: 700; font-size: var(--text-md);
  color: var(--text-primary);
  margin-bottom: 14px;
  :deep(.anticon) { color: var(--accent); }
}
.comment-form {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border-inset);
  margin-bottom: 16px;
}
.comment-form input {
  flex: 1; min-width: 0;
  border: none; background: transparent; outline: none;
  font-family: inherit; font-size: var(--text-sm);
  color: var(--text-primary);
  &::placeholder { color: var(--text-muted); }
}
.comment-form button {
  appearance: none; cursor: pointer;
  border: none;
  padding: 6px 14px; border-radius: var(--radius-full);
  font-family: inherit; font-size: var(--text-xs); font-weight: 600;
  color: #fff;
  background: var(--accent);
  transition: opacity var(--dur-fast) var(--ease-out);
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}
.comment-avatar {
  display: grid; place-items: center;
  width: 30px; height: 30px; flex-shrink: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 50%, #8b5cf6));
  color: #fff; font-size: 14px;
}
.comment-list { display: flex; flex-direction: column; gap: 14px; }
.comment-item { display: flex; gap: 10px; }
.comment-main { flex: 1; min-width: 0; }
.comment-meta { display: flex; align-items: center; gap: 8px; }
.comment-author { font-weight: 600; font-size: var(--text-sm); color: var(--text-primary); }
.comment-date { font-size: var(--text-xs); color: var(--text-muted); }
.comment-text { margin: 3px 0 0; font-size: var(--text-sm); line-height: 1.55; color: var(--text-secondary); word-break: break-word; }

/* ============ 底部操作栏 ============ */
.detail-actions {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 30px;
  border-top: 1px solid var(--glass-border-inset);
  background: var(--glass-bg-strong);
}
.action-btn {
  appearance: none; cursor: pointer;
  display: inline-flex; align-items: center; gap: 7px;
  height: 38px; padding: 0 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border-inset);
  background: var(--glass-bg-soft);
  font-family: inherit; font-size: var(--text-sm); font-weight: 600;
  color: var(--text-secondary);
  transition: all var(--dur-fast) var(--ease-out);
  :deep(.anticon) { font-size: 16px; }
  &:hover { color: var(--text-primary); border-color: color-mix(in srgb, var(--accent) 35%, transparent); }
}
.action-btn.active { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); background: var(--accent-soft); }
.like-btn.active { color: #ec4899; border-color: color-mix(in srgb, #ec4899 40%, transparent); background: color-mix(in srgb, #ec4899 10%, transparent); }
.like-btn.active :deep(.anticon) { color: #ec4899; }
.like-btn.burst :deep(.anticon) { animation: heart-pop 0.42s var(--ease-spring); }
@keyframes heart-pop { 0% { transform: scale(1); } 35% { transform: scale(1.45); } 100% { transform: scale(1); } }

.action-visit {
  margin-left: auto;
  display: inline-flex; align-items: center; gap: 7px;
  height: 38px; padding: 0 18px;
  border-radius: var(--radius-full);
  text-decoration: none;
  font-size: var(--text-sm); font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #8b5cf6));
  box-shadow: var(--shadow-accent);
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
  :deep(.anticon) { font-size: 13px; transform: rotate(45deg); }
  &:hover { transform: translateY(-2px); box-shadow: 0 12px 30px var(--accent-glow); }
}

/* ============ Toast ============ */
.detail-toast {
  position: fixed; bottom: 36px; left: 50%; transform: translateX(-50%);
  z-index: 1300;
  padding: 11px 22px;
  border-radius: var(--radius-full);
  background: rgba(15, 15, 22, 0.9);
  backdrop-filter: blur(12px);
  color: #fff;
  font-size: var(--text-sm); font-weight: 500;
  box-shadow: var(--shadow-lg);
}

/* ============ 过渡动画 ============ */
.detail-fade-enter-active, .detail-fade-leave-active { transition: opacity 0.25s var(--ease-out); }
.detail-fade-enter-from, .detail-fade-leave-to { opacity: 0; }
.detail-pop-enter-active { transition: opacity 0.3s var(--ease-out), transform 0.3s var(--ease-spring); }
.detail-pop-leave-active { transition: opacity 0.2s var(--ease-out), transform 0.2s var(--ease-out); }
.detail-pop-enter-from { opacity: 0; transform: scale(0.94) translateY(12px); }
.detail-pop-leave-to { opacity: 0; transform: scale(0.96); }

.toast-enter-active, .toast-leave-active { transition: opacity 0.25s var(--ease-out), transform 0.25s var(--ease-out); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 16px); }

.comment-enter-active { transition: all 0.3s var(--ease-out); }
.comment-enter-from { opacity: 0; transform: translateX(-12px); }
.comment-leave-active { transition: all 0.2s var(--ease-out); position: absolute; }
.comment-leave-to { opacity: 0; transform: translateX(20px); }

/* ============ 响应式 ============ */
@media (max-width: 760px) {
  .detail-card { max-width: 100%; max-height: calc(100vh - 32px); }
  .detail-grid { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  .detail-visual { min-height: 200px; }
  .visual-appicon { width: 76px; height: 76px; border-radius: 20px; }
  .visual-letter { font-size: 38px; }
  .visual-name { font-size: 20px; }
  .visual-content { gap: 10px; padding: 28px 20px; }
  .body-scroll { padding: 22px 20px 8px; }
  .detail-actions { padding: 12px 20px; flex-wrap: wrap; }
  .action-visit { margin-left: 0; flex: 1; justify-content: center; }
}

@media (prefers-reduced-motion: reduce) {
  .blob-1, .blob-2 { animation: none; }
  .detail-pop-enter-active, .detail-pop-leave-active { transition: opacity 0.2s; }
}
</style>
