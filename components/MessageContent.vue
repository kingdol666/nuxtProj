<script setup lang="ts">
// MessageContent.vue — 统一消息内容渲染（文本 / 图片 / GIF）
// 被 ChatPanel（私信）和 GroupChatPanel（群聊）共用。
import { ref } from 'vue'

const props = defineProps<{
  type: 1 | 2 | 3            // 1=文本 2=图片 3=GIF
  text?: string
  url?: string
  w?: number
  h?: number
}>()

const previewSrc = ref<string | null>(null)

function openPreview() {
  if (props.url) previewSrc.value = props.url
}
function closePreview() {
  previewSrc.value = null
}
</script>

<template>
  <div class="mc">
    <!-- 文本 -->
    <p v-if="type === 1" class="mc-text">{{ text }}</p>

    <!-- 图片 -->
    <img
      v-else-if="type === 2 && url"
      class="mc-img"
      :src="url"
      :width="w || undefined"
      :height="h || undefined"
      loading="lazy"
      alt="图片"
      @click="openPreview"
    />

    <!-- GIF -->
    <img
      v-else-if="type === 3 && url"
      class="mc-gif"
      :src="url"
      loading="lazy"
      alt="GIF"
      @click="openPreview"
    />

    <!-- 兜底 -->
    <p v-else class="mc-text mc-fallback">{{ text || '[不支持的消息]' }}</p>

    <!-- 全屏预览 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="previewSrc" class="mc-preview-overlay" @click="closePreview">
          <img :src="previewSrc" class="mc-preview-img" alt="预览" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped lang="less">
.mc-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}
.mc-fallback {
  opacity: 0.6;
  font-style: italic;
}
.mc-img {
  max-width: 220px;
  max-height: 220px;
  border-radius: 8px;
  cursor: zoom-in;
  display: block;
  object-fit: contain;
}
.mc-gif {
  max-width: 160px;
  max-height: 160px;
  border-radius: 8px;
  cursor: zoom-in;
  display: block;
}
.mc-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}
.mc-preview-img {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 8px;
  object-fit: contain;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
