<script setup lang="ts">
// PostEditorModal.vue — 发帖编辑器（标题 / 正文 / 多图上传 / 标签）
import { ref, reactive, computed, watch } from 'vue'
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
// 是否生成主题大图作为封面（radio 开关；无图片时强制开启）
const useCoverGen = ref(true)
// 封面索引（多图时用户选择哪张做封面；默认第一张）
const coverIndex = ref(0)
// 未上传图片时的自动封面配色（10 套渐变）
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
// 是否显示主题大图预览：无图片时强制（必须生成封面），或有图片但用户选了「生成主题图」
const showCoverGenPreview = computed(() => title.value.trim() && (images.value.length === 0 || useCoverGen.value))

// 封面预览：防抖更新，避免每次按键都请求服务端生成图片
const coverPreviewUrl = ref('')
let coverPreviewTimer: ReturnType<typeof setTimeout> | null = null
function updateCoverPreview() {
  // 有图片且未开启主题图生成 → 显示已选封面图
  if (images.value.length > 0 && !useCoverGen.value) {
    coverPreviewUrl.value = images.value[coverIndex.value] || ''
    return
  }
  // 无图片或开启了主题图生成 → 生成主题封面预览
  if (!title.value.trim()) { coverPreviewUrl.value = ''; return }
  if (coverPreviewTimer) clearTimeout(coverPreviewTimer)
  coverPreviewTimer = setTimeout(() => {
    const titleEnc = encodeURIComponent(title.value.trim() || '未填写标题')
    const contentEnc = encodeURIComponent(content.value.trim().slice(0, 100))
    const tagsEnc = encodeURIComponent(tags.value.join(','))
    coverPreviewUrl.value = `/api/poster/cover?title=${titleEnc}&content=${contentEnc}&tags=${tagsEnc}&gradient=${selectedGradient.value}&t=${Date.now()}`
  }, 400)
}
watch([title, content, tags, selectedGradient, images, coverIndex, useCoverGen], updateCoverPreview, { immediate: true, deep: true })
const fileInput = ref<HTMLInputElement | null>(null)

// 进入弹窗时：编辑模式回填，否则清空
const isEditing = computed(() => !!props.post?.id)
watch(() => props.open, (v) => {
  if (v) {
    const p = props.post
    title.value = p?.title ?? ''
    content.value = p?.content ?? ''
    images.value = p ? [...(p.images || [])] : []
    videos.value = p ? [...(p.videos || [])] : []
    tags.value = p ? [...(p.tags || [])] : []
    tagInput.value = ''
    coverIndex.value = 0
    selectedGradient.value = 0
    // 新建时默认开启主题图；编辑时：有图片默认关闭，无图片强制开启
    useCoverGen.value = isEditing.value ? (images.value.length === 0) : true
  }
})

const canSubmit = computed(() => title.value.trim() && content.value.trim() && !submitting.value)
const totalMedia = computed(() => images.value.length + videos.value.length)
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.ogg', '.ogv'])

function close() { emit('update:open', false) }

function pickFiles() {
  if (!isLoggedIn.value) { openAuthModal(); return }
  fileInput.value?.click()
}

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  uploading.value = true
  try {
    for (const file of Array.from(input.files)) {
      if (totalMedia.value >= 9) { message.warning('最多上传 9 个文件'); break }
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
      const isVideo = VIDEO_EXTS.has(ext)
      if (isVideo && videos.value.length >= 4) { message.warning('最多上传 4 个视频'); continue }
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await $fetch<{ url: string; kind: string }>('/api/upload?purpose=post', { method: 'POST', body: fd })
        if (res.kind === 'video' || isVideo) videos.value.push(res.url)
        else images.value.push(res.url)
      } catch {
        message.error(`文件「${file.name}」上传失败`)
      }
    }
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function removeImage(i: number) {
  images.value.splice(i, 1)
  if (coverIndex.value >= images.value.length) coverIndex.value = Math.max(0, images.value.length - 1)
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
async function submit() {
  if (!isLoggedIn.value) { openAuthModal(); return }
  if (!canSubmit.value) return
  submitting.value = true
  try {
    // 判断是否需要生成主题大图封面
    // 规则：无图片时强制生成；有图片时看 useCoverGen 开关
    const mustGenCover = images.value.length === 0
    const wantGenCover = useCoverGen.value || mustGenCover

    // 多图时：把用户选的封面移到第一位（与小红书一致）
    let finalImages = images.value
    if (!wantGenCover && images.value.length > 1 && coverIndex.value > 0) {
      finalImages = [images.value[coverIndex.value], ...images.value.filter((_, i) => i !== coverIndex.value)]
    }
    // 若开启主题图生成：清空已上传图片（让后端生成），但保留视频
    if (wantGenCover) finalImages = []

    const payload = {
      title: title.value.trim(),
      content: content.value.trim(),
      images: finalImages,
      videos: videos.value,
      tags: tags.value,
      coverGradient: selectedGradient.value,
      useCoverGen: wantGenCover,
    }
    if (isEditing.value && props.post) {
      const updated = await updatePost(props.post.id, payload)
      message.success('已更新')
      emit('updated', updated)
      close()
    } else {
      await createPost(payload)
      message.success('发布成功！')
      emit('created')
      close()
    }
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
          <!-- Images -->
          <div v-for="(img, i) in images" :key="'img-'+i" class="img-item" :class="{ 'is-cover': i === coverIndex }">
            <img :src="img" alt="" />
            <button class="img-del" @click="removeImage(i)" aria-label="删除"><DeleteOutlined /></button>
            <button v-if="images.length > 1" class="cover-badge" :class="{ active: i === coverIndex }" @click="coverIndex = i" :title="i === coverIndex ? '当前封面' : '设为封面'">
              <StarFilled v-if="i === coverIndex" />
              <StarOutlined v-else />
            </button>
          </div>
          <!-- Videos -->
          <div v-for="(vid, i) in videos" :key="'vid-'+i" class="img-item video-item">
            <video :src="vid" preload="metadata" />
            <span class="vid-badge"><VideoCameraOutlined /> 视频</span>
            <button class="img-del" @click="removeVideo(i)" aria-label="删除"><DeleteOutlined /></button>
          </div>
          <!-- Upload button -->
          <button v-if="totalMedia < 9" class="img-add" @click="pickFiles" :disabled="uploading">
            <div v-if="uploading" class="spinner" />
            <template v-else>
              <PlusOutlined class="add-icon" />
              <span class="add-text">图片/视频</span>
            </template>
          </button>
        </div>

        <!-- 封面预览 + 配色选择（生成主题大图时显示） -->
        <div v-if="showCoverGenPreview" class="cover-preview-section">
          <div class="cover-preview-label">
            <PictureOutlined /> 主题封面预览<span v-if="images.length === 0" class="cover-forced-hint">（无图片，自动生成封面）</span>
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
      <div class="field title-field">
        <input
          v-model="title"
          class="title-input"
          type="text"
          maxlength="100"
          placeholder="填写标题更能吸引注意哦"
        />
        <label v-if="images.length > 0" class="cover-gen-toggle" :title="useCoverGen ? '当前使用主题文字大图作为封面' : '勾选后用主题文字大图替换封面'">
          <input type="checkbox" v-model="useCoverGen" />
          <span class="cgt-label">生成主题封面图</span>
        </label>
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
          <PictureOutlined /> {{ images.length }} 张图片 · {{ tags.length }} 个标签
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
.editor-head {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 4px;
}
.editor-head h2 {
  font-size: var(--text-lg); font-weight: 700; margin: 0; color: var(--text-primary);
}
.close-btn {
  background: var(--bg-subtle); border: none; border-radius: 50%;
  width: 32px; height: 32px; cursor: pointer; color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
  transition: all var(--dur-fast);
}
.close-btn:hover { background: var(--danger); color: #fff; }

.images-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.img-item {
  position: relative; aspect-ratio: 1; border-radius: var(--radius-md); overflow: hidden;
  background: var(--bg-subtle);
}
.img-item img { width: 100%; height: 100%; object-fit: cover; }
.img-item video { width: 100%; height: 100%; object-fit: cover; }
.video-item { background: #000; }
.vid-badge {
  position: absolute; bottom: 4px; left: 4px; display: inline-flex; align-items: center; gap: 3px;
  background: rgba(0,0,0,0.65); color: #fff; font-size: 10px; font-weight: 600;
  padding: 2px 7px; border-radius: var(--radius-full); backdrop-filter: blur(4px);
}
.img-del {
  position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6);
  color: #fff; border: none; border-radius: 50%; width: 22px; height: 22px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 12px; transition: background var(--dur-fast);
}
.img-del:hover { background: var(--danger); }
.img-add {
  aspect-ratio: 1; border: 2px dashed var(--border-strong); border-radius: var(--radius-md);
  background: var(--accent-soft); cursor: pointer; color: var(--accent);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  transition: all var(--dur-fast);
}
.img-add:hover:not(:disabled) { border-color: var(--accent); background: var(--accent-soft); }
.img-add:disabled { cursor: wait; opacity: 0.6; }
.add-icon { font-size: 22px; }
.add-text { font-size: var(--text-xs); }
.spinner {
  width: 20px; height: 20px; border: 2px solid var(--border-strong);
  border-top-color: var(--accent); border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.hint { font-size: var(--text-xs); color: var(--text-muted); margin: 0; }

.field { display: flex; flex-direction: column; }
.title-input {
  font-size: var(--text-lg); font-weight: 600; color: var(--text-primary);
  background: transparent; border: none; border-bottom: 1px solid var(--border-color);
  padding: 8px 0; outline: none; transition: border-color var(--dur-fast);
}
.title-input:focus { border-bottom-color: var(--accent); }
.content-input {
  font-size: var(--text-base); color: var(--text-primary);
  background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md);
  padding: 12px; outline: none; resize: vertical; min-height: 120px; line-height: var(--leading-normal);
  font-family: var(--font-sans); transition: border-color var(--dur-fast);
}
.content-input:focus { border-color: var(--accent); }
.char-count {
  align-self: flex-end; font-size: var(--text-xs); color: var(--text-muted); margin-top: 4px;
}

.tags-field { }
.tags-row {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md);
  padding: 6px 8px; min-height: 40px;
}
.tag-chip {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--accent-soft); color: var(--accent);
  font-size: var(--text-xs); padding: 3px 8px; border-radius: var(--radius-full);
}
.tag-x {
  background: none; border: none; color: var(--accent); cursor: pointer;
  font-size: 14px; line-height: 1; padding: 0; opacity: 0.7;
}
.tag-x:hover { opacity: 1; }
.tag-input {
  flex: 1; min-width: 100px; border: none; background: transparent; outline: none;
  font-size: var(--text-sm); color: var(--text-primary);
}

.editor-foot {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: 8px; border-top: 1px solid var(--border-color);
}
.foot-hint { font-size: var(--text-xs); color: var(--text-muted); }
.publish-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--accent); color: #fff; border: none;
  border-radius: var(--radius-full); padding: 8px 22px;
  font-size: var(--text-base); font-weight: 600; cursor: pointer;
  transition: all var(--dur-fast);
}
.publish-btn:hover:not(:disabled) { background: var(--accent-hover); transform: translateY(-1px); }
.publish-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 封面选择徽标 */
.img-item { position: relative; }
.img-item.is-cover { box-shadow: 0 0 0 3px var(--accent), 0 0 0 5px rgba(99,102,241,0.2); border-radius: var(--radius-md); }
.cover-badge {
  position: absolute; top: 4px; right: 28px; width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.5); border: none; border-radius: 50%; color: #fff;
  cursor: pointer; font-size: 12px; transition: all var(--dur-fast);
}
.cover-badge.active { background: var(--accent); color: #fff; }
.cover-badge:hover { background: var(--accent-hover); }

/* 自动封面预览 */
.cover-preview-section { margin-top: 12px; }
.cover-preview-label { font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.cover-preview-box {
  width: 100%; max-width: 240px; border-radius: var(--radius-lg); overflow: hidden;
  box-shadow: var(--shadow-md); margin: 0 auto;
}
.cover-preview-img { width: 100%; display: block; }

/* 配色选择器 */
.gradient-picker { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.gp-label { font-size: var(--text-xs); color: var(--text-secondary); }
.gp-swatch {
  width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent;
  cursor: pointer; transition: all var(--dur-fast);
}
.gp-swatch.active { border-color: var(--text-primary); transform: scale(1.15); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
.gp-swatch:hover { transform: scale(1.1); }

/* 主题封面图开关 */
.title-field { position: relative; }
.cover-gen-toggle {
  display: flex; align-items: center; gap: 5px; margin-top: 6px;
  font-size: var(--text-xs); color: var(--text-secondary); cursor: pointer;
  user-select: none;
}
.cover-gen-toggle input { width: 14px; height: 14px; cursor: pointer; accent-color: var(--accent); }
.cover-gen-toggle .cgt-label { font-weight: 500; }
.cover-gen-toggle:hover .cgt-label { color: var(--accent); }
.cover-forced-hint { font-size: var(--text-xs); color: var(--text-muted); margin-left: 4px; }
</style>
