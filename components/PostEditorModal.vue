<script setup lang="ts">
// PostEditorModal.vue — 发帖编辑器（标题 / 正文 / 多图上传 / 标签 / 封面选择）
// 封面选择逻辑：
//   coverMode = 'image'     → 用上传图片做封面（可指定哪张）
//   coverMode = 'generated' → 用主题文字大图做封面（后端生成）
//   无图片时 coverMode 强制为 'generated'
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  PictureOutlined,
  VideoCameraOutlined,
  PlusOutlined,
  CloseOutlined,
  DeleteOutlined,
  SendOutlined,
  StarOutlined,
  StarFilled,
} from '@ant-design/icons-vue'
import { usePosts, type Post } from '~/composables/usePosts'
import { useAuth } from '~/composables/useAuth'

const props = defineProps<{ open: boolean; post?: Post | null }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'created'): void; (e: 'updated', post: Post): void }>()

const { createPost, updatePost } = usePosts()
const { isLoggedIn, openAuthModal } = useAuth()

const title = ref('')
const content = ref('')
const images = ref<string[]>([])
const videos = ref<string[]>([])
const tags = ref<string[]>([])
const tagInput = ref('')
const uploading = ref(false)
const submitting = ref(false)

// 待上传文件（选择后仅本地预览，点击「发布」时才统一上传）
interface PendingFile { file: File; preview: string; kind: 'image' | 'video' }
const pendingFiles = ref<PendingFile[]>([])

// ── 封面控制 ──
// coverMode: 'image' = 用上传图片做封面; 'generated' = 用主题大图做封面
const coverMode = ref<'image' | 'generated'>('generated')
// 多图时封面索引（哪张图做封面，排第一位）
const coverIndex = ref(0)
// 主题封面配色
const gradientPalettes = [
  { from: '#667eea', to: '#764ba2', name: '紫罗兰' },
  { from: '#f093fb', to: '#f5576c', name: '粉色' },
  { from: '#4facfe', to: '#00f2fe', name: '青色' },
  { from: '#43e97b', to: '#38f9d7', name: '绿色' },
  { from: '#fa709a', to: '#fee140', name: '橙粉' },
  { from: '#30cfd0', to: '#330867', name: '深蓝' },
  { from: '#a8edea', to: '#fed6e3', name: '薄荷粉' },
  { from: '#ff9a9e', to: '#fecfef', name: '浅粉' },
  { from: '#ffecd2', to: '#fcb69f', name: '暖橙' },
  { from: '#a1c4fd', to: '#c2e9fb', name: '天蓝' },
]
const selectedGradient = ref(0)

// 有多少张图片（已上传 + 待上传的图片，不含视频）
const imageCount = computed(() => images.value.length + pendingFiles.value.filter((p) => p.kind === 'image').length)
// 是否可用「上传图片」做封面（至少有一张图片）
const canUseImageCover = computed(() => imageCount.value > 0)
// 当无图片时，coverMode 自动切到 generated
watch(canUseImageCover, (v) => {
  if (!v) coverMode.value = 'generated'
}, { immediate: true })

// ── 主题封面预览（防抖，避免每次按键请求服务端）──
const coverPreviewUrl = ref('')
let coverPreviewTimer: ReturnType<typeof setTimeout> | null = null
function updateCoverPreview() {
  if (coverMode.value !== 'generated' || !title.value.trim()) { coverPreviewUrl.value = ''; return }
  if (coverPreviewTimer) clearTimeout(coverPreviewTimer)
  coverPreviewTimer = setTimeout(() => {
    const t = encodeURIComponent(title.value.trim() || '未填写标题')
    const c = encodeURIComponent(content.value.trim().slice(0, 100))
    const tg = encodeURIComponent(tags.value.join(','))
    coverPreviewUrl.value = `/api/poster/cover?title=${t}&content=${c}&tags=${tg}&gradient=${selectedGradient.value}&t=${Date.now()}`
  }, 400)
}
watch([title, content, tags, selectedGradient, coverMode], updateCoverPreview, { immediate: true })

const fileInput = ref<HTMLInputElement | null>(null)
const isEditing = computed(() => !!props.post?.id)

// 进入弹窗时重置
watch(() => props.open, (v) => {
  if (!v) return
  const p = props.post
  title.value = p?.title ?? ''
  content.value = p?.content ?? ''
  images.value = p ? [...(p.images || [])] : []
  videos.value = p ? [...(p.videos || [])] : []
  tags.value = p ? [...(p.tags || [])] : []
  tagInput.value = ''
  for (const pf of pendingFiles.value) URL.revokeObjectURL(pf.preview)
  pendingFiles.value = []
  coverIndex.value = 0
  selectedGradient.value = 0
  // 有图片默认用图片做封面；无图片用主题大图
  coverMode.value = (p && p.images?.length > 0) ? 'image' : 'generated'
})

const canSubmit = computed(() => !!title.value.trim() && !!content.value.trim() && !submitting.value)
const totalMedia = computed(() => images.value.length + videos.value.length + pendingFiles.value.length)
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.ogg', '.ogv'])

function close() { emit('update:open', false) }

function pickFiles() {
  if (!isLoggedIn.value) { openAuthModal(); return }
  fileInput.value?.click()
}

// 选择文件 → 仅本地预览，不立即上传
function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  for (const file of Array.from(input.files)) {
    if (totalMedia.value >= 9) { message.warning('最多上传 9 个文件'); break }
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
    const kind: 'image' | 'video' = VIDEO_EXTS.has(ext) ? 'video' : 'image'
    if (kind === 'video') {
      const vc = videos.value.length + pendingFiles.value.filter((p) => p.kind === 'video').length
      if (vc >= 4) { message.warning('最多上传 4 个视频'); continue }
    }
    pendingFiles.value.push({ file, preview: URL.createObjectURL(file), kind })
  }
  // 第一次添加图片时，自动切到图片封面模式
  if (coverMode.value === 'generated' && canUseImageCover.value) coverMode.value = 'image'
  input.value = ''
}

function removeImage(i: number) {
  images.value.splice(i, 1)
  if (coverIndex.value >= images.value.length) coverIndex.value = Math.max(0, images.value.length - 1)
}
function removePending(i: number) {
  const pf = pendingFiles.value[i]
  if (pf) URL.revokeObjectURL(pf.preview)
  pendingFiles.value.splice(i, 1)
}
function removeVideo(i: number) { videos.value.splice(i, 1) }

function addTag() {
  const t = tagInput.value.trim()
  if (!t) return
  if (tags.value.includes(t)) { tagInput.value = ''; return }
  if (tags.value.length >= 10) { message.warning('最多 10 个标签'); return }
  tags.value.push(t)
  tagInput.value = ''
}
function removeTag(i: number) { tags.value.splice(i, 1) }

// ── 发布/更新 ──
async function submit() {
  if (!isLoggedIn.value) { openAuthModal(); return }
  if (!canSubmit.value) return
  submitting.value = true
  try {
    // 1. 上传所有待传文件（点击「发布」时才真正请求 /api/upload）
    if (pendingFiles.value.length > 0) {
      uploading.value = true
      for (const pf of pendingFiles.value) {
        const fd = new FormData()
        fd.append('file', pf.file)
        try {
          const res = await $fetch<{ url: string; kind: string }>('/api/upload?purpose=post', { method: 'POST', body: fd })
          if (pf.kind === 'video') videos.value.push(res.url)
          else images.value.push(res.url)
        } catch {
          message.error(`文件「${pf.file.name}」上传失败`)
        }
      }
      for (const pf of pendingFiles.value) URL.revokeObjectURL(pf.preview)
      pendingFiles.value = []
      uploading.value = false
    }

    // 2. 封面逻辑
    // coverMode='generated' → 后端生成主题封面（不传图片）
    // coverMode='image'     → 用上传的图片；封面排第一位
    // 无图片时后端强制生成（不管 coverMode）
    const wantGen = coverMode.value === 'generated' || images.value.length === 0
    let finalImages = images.value
    if (!wantGen && images.value.length > 1 && coverIndex.value > 0) {
      // 用户选的封面排第一位
      finalImages = [images.value[coverIndex.value], ...images.value.filter((_, i) => i !== coverIndex.value)]
    }
    if (wantGen) finalImages = []

    const payload = {
      title: title.value.trim(),
      content: content.value.trim(),
      images: finalImages,
      videos: videos.value,
      tags: tags.value,
      coverGradient: selectedGradient.value,
      useCoverGen: wantGen,
    }
    if (isEditing.value && props.post) {
      const updated = await updatePost(props.post.id, payload)
      message.success('已更新')
      emit('updated', updated)
    } else {
      await createPost(payload)
      message.success('发布成功！')
      emit('created')
    }
    close()
  } catch (err: unknown) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    message.error(msg || '操作失败，请重试')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <a-modal
    :open="open"
    @update:open="(v: boolean) => emit('update:open', v)"
    :footer="null"
    :width="560"
    :title="null"
    :closable="false"
    :destroy-on-close="true"
    wrap-class-name="post-editor-modal"
    centered
  >
    <div class="editor">
      <header class="editor-head">
        <h2>{{ isEditing ? '编辑笔记' : '发布笔记' }}</h2>
        <button class="close-btn" @click="close" aria-label="关闭"><CloseOutlined /></button>
      </header>

      <!-- 图片上传区 -->
      <div class="images-section">
        <div class="images-grid">
          <!-- 已上传图片 -->
          <div v-for="(img, i) in images" :key="'img-'+i" class="img-item" :class="{ 'is-cover': coverMode === 'image' && i === coverIndex }">
            <img :src="img" alt="" />
            <button class="img-del" @click="removeImage(i)" aria-label="删除"><DeleteOutlined /></button>
            <button v-if="coverMode === 'image' && images.length > 1" class="cover-badge" :class="{ active: i === coverIndex }" @click="coverIndex = i" :title="i === coverIndex ? '当前封面' : '设为封面'">
              <StarFilled v-if="i === coverIndex" />
              <StarOutlined v-else />
            </button>
          </div>
          <!-- 视频 -->
          <div v-for="(vid, i) in videos" :key="'vid-'+i" class="img-item video-item">
            <video :src="vid" preload="metadata" />
            <span class="vid-badge"><VideoCameraOutlined /> 视频</span>
            <button class="img-del" @click="removeVideo(i)" aria-label="删除"><DeleteOutlined /></button>
          </div>
          <!-- 待上传文件（本地预览） -->
          <div v-for="(pf, i) in pendingFiles" :key="'pend-'+i" class="img-item" :class="{ 'video-item': pf.kind === 'video' }">
            <img v-if="pf.kind === 'image'" :src="pf.preview" alt="" />
            <video v-else :src="pf.preview" preload="metadata" />
            <span v-if="pf.kind === 'video'" class="vid-badge"><VideoCameraOutlined /> 视频</span>
            <button class="img-del" @click="removePending(i)" aria-label="删除"><DeleteOutlined /></button>
            <span class="pending-badge">待上传</span>
          </div>
          <!-- 上传按钮 -->
          <button v-if="totalMedia < 9" class="img-add" @click="pickFiles" :disabled="uploading || submitting">
            <div v-if="uploading" class="spinner" />
            <template v-else>
              <PlusOutlined class="add-icon" />
              <span class="add-text">图片/视频</span>
            </template>
          </button>
        </div>

        <!-- 封面来源选择 -->
        <div class="cover-source-picker">
          <span class="csp-label">封面来源：</span>
          <button class="csp-btn" :class="{ active: coverMode === 'image' }" :disabled="!canUseImageCover" @click="coverMode = 'image'">
            <PictureOutlined /> 上传图片
          </button>
          <button class="csp-btn" :class="{ active: coverMode === 'generated' }" @click="coverMode = 'generated'">
            <StarOutlined /> 主题大图
          </button>
          <span v-if="!canUseImageCover" class="csp-hint">（无图片时使用主题大图）</span>
        </div>

        <!-- 主题封面预览 + 配色（选择「主题大图」时显示） -->
        <div v-if="coverMode === 'generated' && title.trim()" class="cover-preview-section">
          <div class="cover-preview-label">
            <PictureOutlined /> 主题封面预览
          </div>
          <div class="cover-preview-box">
            <img :src="coverPreviewUrl" alt="封面预览" class="cover-preview-img" :key="coverPreviewUrl" />
          </div>
          <div class="gradient-picker">
            <span class="gp-label">配色：</span>
            <button
              v-for="(g, i) in gradientPalettes"
              :key="i"
              class="gp-swatch"
              :class="{ active: selectedGradient === i }"
              :style="{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }"
              :title="g.name"
              @click="selectedGradient = i"
            />
          </div>
        </div>

        <p class="hint">最多 9 个文件（图片 ≤ 8MB，视频 ≤ 100MB）· 支持 JPG/PNG/GIF/MP4/WebM</p>
        <input ref="fileInput" type="file" accept="image/*,video/*" multiple hidden @change="onFiles" />
      </div>

      <!-- 标题 -->
      <div class="field">
        <input
          v-model="title"
          class="title-input"
          type="text"
          maxlength="100"
          placeholder="填写标题更能吸引注意哦"
        />
      </div>

      <!-- 正文 -->
      <div class="field">
        <textarea
          v-model="content"
          class="content-input"
          rows="6"
          maxlength="5000"
          placeholder="分享你的想法、经历或发现…（支持换行）"
        />
        <div class="char-count">{{ content.length }} / 5000</div>
      </div>

      <!-- 标签 -->
      <div class="field tags-field">
        <div class="tags-row">
          <span v-for="(t, i) in tags" :key="t" class="tag-chip">
            #{{ t }}
            <button class="tag-x" @click="removeTag(i)" aria-label="移除标签">×</button>
          </span>
          <input
            v-model="tagInput"
            class="tag-input"
            type="text"
            maxlength="20"
            placeholder="输入标签后回车"
            @keydown.enter.prevent="addTag"
          />
        </div>
      </div>

      <!-- 底部操作 -->
      <footer class="editor-foot">
        <span class="foot-hint">
          <PictureOutlined /> {{ imageCount }} 张图片 · {{ tags.length }} 个标签
        </span>
        <button class="publish-btn" :disabled="!canSubmit" @click="submit">
          <SendOutlined /> {{ isEditing ? '保存' : '发布' }}
        </button>
      </footer>
    </div>
  </a-modal>
</template>

<style scoped lang="less">
.editor { display: flex; flex-direction: column; gap: 14px; }
.editor-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid var(--border-color); }
.editor-head h2 { font-size: var(--text-lg); font-weight: 700; margin: 0; }

.images-section { display: flex; flex-direction: column; gap: 8px; }
.images-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  min-height: 100px;
}
.img-item {
  position: relative; aspect-ratio: 1; border-radius: var(--radius-md); overflow: hidden;
  border: 1px solid var(--border-color); background: var(--bg-subtle);
}
.img-item.is-cover { box-shadow: 0 0 0 3px var(--accent), 0 0 0 5px rgba(99,102,241,0.2); }
.img-item img, .img-item video { width: 100%; height: 100%; object-fit: cover; }
.img-del {
  position: absolute; top: 4px; right: 4px; width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.6); border: none; border-radius: 50%; color: #fff;
  cursor: pointer; font-size: 12px;
}
.cover-badge {
  position: absolute; top: 4px; right: 30px; width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.5); border: none; border-radius: 50%; color: #fff;
  cursor: pointer; font-size: 12px;
}
.cover-badge.active { background: var(--accent); }
.cover-badge:hover { background: var(--accent-hover); }
.vid-badge {
  position: absolute; bottom: 4px; left: 4px; padding: 2px 6px;
  font-size: 10px; color: #fff; background: rgba(0,0,0,0.6); border-radius: 4px;
}
.pending-badge {
  position: absolute; bottom: 4px; left: 4px; padding: 2px 6px;
  font-size: 10px; color: #fff; background: rgba(99,102,241,0.8); border-radius: 4px;
}
.img-add {
  aspect-ratio: 1; border: 2px dashed var(--border-strong); border-radius: var(--radius-md);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  background: var(--bg-subtle); cursor: pointer; color: var(--text-muted); transition: all var(--dur-fast);
}
.img-add:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
.img-add:disabled { opacity: 0.5; cursor: not-allowed; }
.add-icon { font-size: 24px; }
.add-text { font-size: 11px; }

/* 封面来源选择器 */
.cover-source-picker {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 6px 0;
}
.csp-label { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; }
.csp-btn {
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px;
  border: 1px solid var(--border-color); border-radius: var(--radius-full);
  background: var(--bg-surface); color: var(--text-secondary);
  font-size: var(--text-xs); cursor: pointer; transition: all var(--dur-fast);
}
.csp-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.csp-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.csp-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.csp-hint { font-size: var(--text-xs); color: var(--text-muted); }

.cover-preview-section { margin-top: 8px; }
.cover-preview-label { font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.cover-preview-box { width: 100%; max-width: 220px; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md); margin: 0 auto; }
.cover-preview-img { width: 100%; display: block; }
.gradient-picker { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.gp-label { font-size: var(--text-xs); color: var(--text-secondary); }
.gp-swatch { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: all var(--dur-fast); }
.gp-swatch.active { border-color: var(--text-primary); transform: scale(1.15); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
.gp-swatch:hover { transform: scale(1.1); }

.hint { font-size: var(--text-xs); color: var(--text-muted); margin: 0; }

.field { display: flex; flex-direction: column; gap: 4px; }
.title-input {
  width: 100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  font-size: var(--text-md); background: var(--bg-surface); color: var(--text-primary);
  outline: none; transition: border-color var(--dur-fast);
}
.title-input:focus { border-color: var(--accent); }
.content-input {
  width: 100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  font-size: var(--text-sm); background: var(--bg-surface); color: var(--text-primary);
  outline: none; resize: vertical; min-height: 100px; font-family: var(--font-sans);
  transition: border-color var(--dur-fast);
}
.content-input:focus { border-color: var(--accent); }
.char-count { font-size: var(--text-xs); color: var(--text-muted); text-align: right; }

.tags-field { }
.tags-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); min-height: 42px; }
.tag-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; background: var(--accent-soft); color: var(--accent); border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 500; }
.tag-x { border: none; background: none; color: var(--text-muted); cursor: pointer; font-size: 14px; line-height: 1; padding: 0; }
.tag-x:hover { color: var(--danger); }
.tag-input { border: none; outline: none; background: none; font-size: var(--text-sm); color: var(--text-primary); flex: 1; min-width: 100px; }

.editor-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--border-color); }
.foot-hint { font-size: var(--text-xs); color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
.publish-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 24px;
  border: none; border-radius: var(--radius-full); background: var(--accent); color: #fff;
  font-size: var(--text-sm); font-weight: 600; cursor: pointer; transition: all var(--dur-fast);
}
.publish-btn:hover:not(:disabled) { background: var(--accent-hover); transform: translateY(-1px); }
.publish-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.spinner {
  width: 20px; height: 20px; border: 2px solid rgba(99,102,241,0.2);
  border-top-color: var(--accent); border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
