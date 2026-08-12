<script setup lang="ts">
// pages/settings.vue — 个人信息设置
// 修改：头像（上传图片或保持默认配色）、主页背景图、个人简介
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  CameraOutlined,
  PictureOutlined,
  CheckOutlined,
  CloseOutlined,
  UserOutlined,
  ArrowLeftOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import { useAuth } from '~/composables/useAuth'
import { avatarStyle, avatarStyleFull, AVATAR_GRADIENTS } from '~/composables/useAvatar'
import { apiError } from '~/composables/useApiError'

const router = useRouter()
const { user, isLoggedIn, fetchMe, updateProfile, openAuthModal } = useAuth()

const bio = ref('')
const avatarUrl = ref('')
const backgroundUrl = ref('')
const saving = ref(false)
const uploadingAvatar = ref(false)
const uploadingBg = ref(false)

const avatarInput = ref<HTMLInputElement | null>(null)
const bgInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  await fetchMe()
  if (!isLoggedIn.value) {
    openAuthModal()
    return
  }
  bio.value = user.value?.bio || ''
  avatarUrl.value = user.value?.avatarUrl || ''
  backgroundUrl.value = user.value?.backgroundUrl || ''
})

const avatarPreview = computed(() => {
  if (avatarUrl.value) {
    return { backgroundImage: `url(${avatarUrl.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  return avatarStyle(user.value?.avatarColor ?? 0)
})

const hasCustomAvatar = computed(() => !!avatarUrl.value)
const hasCustomBg = computed(() => !!backgroundUrl.value)

async function uploadAvatar(file: File) {
  uploadingAvatar.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await $fetch<{ url: string }>('/api/upload?purpose=avatar', { method: 'POST', body: fd })
    avatarUrl.value = res.url
  } catch (e: unknown) {
    message.error(apiError(e, '头像上传失败'))
  } finally {
    uploadingAvatar.value = false
  }
}

async function uploadBackground(file: File) {
  uploadingBg.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await $fetch<{ url: string }>('/api/upload?purpose=background', { method: 'POST', body: fd })
    backgroundUrl.value = res.url
  } catch (e: unknown) {
    message.error(apiError(e, '背景上传失败'))
  } finally {
    uploadingBg.value = false
  }
}

function onAvatarFile(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) uploadAvatar(input.files[0])
  input.value = ''
}

function onBgFile(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) uploadBackground(input.files[0])
  input.value = ''
}

function clearAvatar() {
  avatarUrl.value = ''
}

function clearBackground() {
  backgroundUrl.value = ''
}

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    await updateProfile({
      bio: bio.value,
      avatarUrl: avatarUrl.value,
      backgroundUrl: backgroundUrl.value,
    })
    message.success('保存成功')
    await fetchMe()
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string } }
    message.error(e?.data?.statusMessage || '保存失败')
  } finally {
    saving.value = false
  }
}

function goBack() {
  if (user.value) router.push(`/user/${user.value.id}`)
  else router.push('/community')
}

useHead({ title: '设置 · 个人信息' })
</script>

<template>
  <div class="settings-page">
    <header class="settings-head">
      <button class="back-btn" @click="goBack"><ArrowLeftOutlined /> 返回</button>
      <h1>个人信息设置</h1>
    </header>

    <div v-if="isLoggedIn" class="settings-body">
      <!-- 背景图设置 -->
      <section class="setting-card glass-strong">
        <h2 class="card-title"><PictureOutlined /> 主页背景</h2>
        <p class="card-desc">上传一张图片作为你的主页横幅背景，其他用户访问你的主页时可以看到。</p>
        <div class="bg-preview" :class="{ empty: !hasCustomBg }">
          <img v-if="hasCustomBg" :src="backgroundUrl" alt="背景预览" />
          <div v-else class="bg-placeholder">
            <PictureOutlined />
            <span>暂未设置背景图</span>
          </div>
          <div class="bg-actions">
            <button class="upload-btn" @click="bgInput?.click()" :disabled="uploadingBg">
              <CameraOutlined v-if="!uploadingBg" />
              <span v-if="uploadingBg" class="mini-spinner" />
              {{ uploadingBg ? '上传中…' : (hasCustomBg ? '更换背景' : '上传背景') }}
            </button>
            <button v-if="hasCustomBg" class="clear-btn" @click="clearBackground">
              <DeleteOutlined /> 移除
            </button>
          </div>
          <input ref="bgInput" type="file" accept="image/*" hidden @change="onBgFile" />
        </div>
      </section>

      <!-- 头像设置 -->
      <section class="setting-card glass-strong">
        <h2 class="card-title"><UserOutlined /> 头像</h2>
        <p class="card-desc">上传自定义头像，或保持默认的渐变配色头像。</p>
        <div class="avatar-section">
          <div class="avatar-preview-wrap">
            <div class="avatar-preview" :style="avatarPreview">
              <span v-if="!hasCustomAvatar" class="avatar-letter">
                {{ user?.username?.charAt(0).toUpperCase() }}
              </span>
            </div>
            <button class="avatar-cam" @click="avatarInput?.click()" :disabled="uploadingAvatar">
              <CameraOutlined v-if="!uploadingAvatar" />
              <span v-else class="mini-spinner" />
            </button>
          </div>
          <div class="avatar-actions">
            <button class="upload-btn sm" @click="avatarInput?.click()" :disabled="uploadingAvatar">
              {{ uploadingAvatar ? '上传中…' : (hasCustomAvatar ? '更换头像' : '上传头像') }}
            </button>
            <button v-if="hasCustomAvatar" class="clear-btn" @click="clearAvatar">
              <DeleteOutlined /> 恢复默认
            </button>
          </div>
          <input ref="avatarInput" type="file" accept="image/*" hidden @change="onAvatarFile" />
        </div>
        <div class="avatar-fallback">
          <span class="fallback-label">默认配色：</span>
          <span
            v-for="(g, i) in AVATAR_GRADIENTS"
            :key="i"
            class="color-dot"
            :class="{ active: (user?.avatarColor ?? 0) === i }"
            :style="{ background: g }"
          />
        </div>
      </section>

      <!-- 简介设置 -->
      <section class="setting-card glass-strong">
        <h2 class="card-title"><UserOutlined /> 个人简介</h2>
        <p class="card-desc">一句话介绍自己，展示在你的主页上。</p>
        <textarea
          v-model="bio"
          class="bio-input"
          rows="3"
          maxlength="200"
          placeholder="写点什么介绍一下自己吧…"
        />
        <div class="bio-count">{{ bio.length }} / 200</div>
      </section>

      <!-- 保存按钮 -->
      <div class="save-bar">
        <button class="cancel-btn" @click="goBack">取消</button>
        <button class="save-btn" :disabled="saving" @click="save">
          <CheckOutlined v-if="!saving" />
          <span v-if="saving" class="mini-spinner light" />
          {{ saving ? '保存中…' : '保存修改' }}
        </button>
      </div>
    </div>

    <!-- 未登录 -->
    <div v-else class="auth-prompt glass">
      <UserOutlined class="prompt-icon" />
      <h2>请先登录</h2>
      <p>登录后才能修改个人信息</p>
      <button class="save-btn" @click="openAuthModal">去登录</button>
    </div>
  </div>
</template>

<style scoped lang="less">
.settings-page { max-width: 680px; margin: 0 auto; padding: 24px 20px 60px; min-height: 60vh; }

.settings-head {
  display: flex; align-items: center; gap: 14px; margin-bottom: 24px;
}
.back-btn {
  display: inline-flex; align-items: center; gap: 4px; background: none; border: none;
  color: var(--accent); cursor: pointer; font-size: var(--text-sm);
}
.back-btn:hover { color: var(--accent-hover); }
.settings-head h1 { margin: 0; font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); }

.setting-card {
  border-radius: var(--radius-xl); padding: 22px 24px; margin-bottom: 18px;
}
.card-title {
  margin: 0 0 6px; font-size: var(--text-lg); font-weight: 700; color: var(--text-primary);
  display: flex; align-items: center; gap: 8px;
}
.card-desc { margin: 0 0 16px; font-size: var(--text-sm); color: var(--text-secondary); line-height: var(--leading-snug); }

/* ── Background preview ── */
.bg-preview {
  position: relative; border-radius: var(--radius-lg); overflow: hidden;
  aspect-ratio: 16 / 6; background: var(--bg-subtle);
}
.bg-preview.empty { border: 2px dashed var(--border-strong); }
.bg-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
.bg-placeholder {
  width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; color: var(--text-muted); font-size: var(--text-sm);
}
.bg-placeholder > :first-child { font-size: 36px; opacity: 0.5; }
.bg-actions {
  position: absolute; bottom: 10px; right: 10px; display: flex; gap: 8px;
}
.upload-btn {
  display: inline-flex; align-items: center; gap: 5px;
  background: rgba(0,0,0,0.65); color: #fff; border: none; border-radius: var(--radius-full);
  padding: 7px 16px; font-size: var(--text-sm); cursor: pointer; backdrop-filter: blur(8px);
  transition: all var(--dur-fast);
}
.upload-btn:hover:not(:disabled) { background: var(--accent); }
.upload-btn.sm { background: var(--accent); }
.upload-btn.sm:hover:not(:disabled) { background: var(--accent-hover); }
.upload-btn:disabled { opacity: 0.6; cursor: wait; }
.clear-btn {
  display: inline-flex; align-items: center; gap: 4px;
  background: rgba(239,68,68,0.85); color: #fff; border: none; border-radius: var(--radius-full);
  padding: 7px 14px; font-size: var(--text-sm); cursor: pointer; backdrop-filter: blur(8px);
  transition: background var(--dur-fast);
}
.clear-btn:hover { background: var(--danger); }

/* ── Avatar section ── */
.avatar-section { display: flex; align-items: center; gap: 20px; margin-bottom: 16px; flex-wrap: wrap; }
.avatar-preview-wrap { position: relative; flex-shrink: 0; }
.avatar-preview {
  width: 90px; height: 90px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 36px; font-weight: 700; box-shadow: var(--shadow-md); overflow: hidden;
}
.avatar-letter { pointer-events: none; }
.avatar-cam {
  position: absolute; bottom: 2px; right: 2px;
  width: 30px; height: 30px; border-radius: 50%; border: 3px solid var(--bg-surface);
  background: var(--accent); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 13px; transition: background var(--dur-fast);
}
.avatar-cam:hover:not(:disabled) { background: var(--accent-hover); }
.avatar-cam:disabled { opacity: 0.6; cursor: wait; }
.avatar-actions { display: flex; flex-direction: column; gap: 8px; }

.avatar-fallback { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.fallback-label { font-size: var(--text-xs); color: var(--text-muted); }
.color-dot {
  width: 22px; height: 22px; border-radius: 50%; cursor: default;
  border: 2px solid transparent; transition: border-color var(--dur-fast);
}
.color-dot.active { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }

/* ── Bio ── */
.bio-input {
  width: 100%; background: var(--bg-subtle); border: 1px solid var(--border-color);
  border-radius: var(--radius-md); padding: 12px 14px; font-size: var(--text-sm);
  color: var(--text-primary); outline: none; resize: vertical; line-height: var(--leading-normal);
  font-family: var(--font-sans); transition: border-color var(--dur-fast);
}
.bio-input:focus { border-color: var(--accent); }
.bio-count { text-align: right; font-size: var(--text-xs); color: var(--text-muted); margin-top: 4px; }

/* ── Save bar ── */
.save-bar {
  display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;
  position: sticky; bottom: 20px; padding: 14px 0;
}
.cancel-btn {
  background: var(--glass-bg-strong); color: var(--text-secondary); border: 1px solid var(--border-color);
  border-radius: var(--radius-full); padding: 10px 24px; font-size: var(--text-sm); cursor: pointer;
  transition: all var(--dur-fast);
}
.cancel-btn:hover { color: var(--text-primary); border-color: var(--border-strong); }
.save-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--accent); color: #fff; border: none; border-radius: var(--radius-full);
  padding: 10px 28px; font-size: var(--text-sm); font-weight: 600; cursor: pointer;
  transition: all var(--dur-fast);
}
.save-btn:hover:not(:disabled) { background: var(--accent-hover); transform: translateY(-1px); }
.save-btn:disabled { opacity: 0.6; cursor: wait; }

/* ── Spinner ── */
.mini-spinner {
  width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%; display: inline-block;
  animation: spin 0.7s linear infinite;
}
.mini-spinner.light { border-color: rgba(255,255,255,0.4); border-top-color: #fff; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Auth prompt ── */
.auth-prompt {
  text-align: center; padding: 60px 24px; border-radius: var(--radius-xl); margin-top: 40px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.prompt-icon { font-size: 48px; color: var(--accent); margin-bottom: 8px; }
.auth-prompt h2 { margin: 0; color: var(--text-primary); }
.auth-prompt p { color: var(--text-secondary); margin: 0 0 16px; }
</style>
