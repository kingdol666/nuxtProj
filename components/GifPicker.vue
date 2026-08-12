<script setup lang="ts">
// GifPicker.vue — GIF 表情选择面板
// 展示内置 GIF 库 + 用户本次会话上传的 GIF，点击即发送。
import { computed } from 'vue'
import { useChatMedia, type GifItem } from '~/composables/useChatMedia'

defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'select', gif: GifItem): void
  (e: 'close'): void
}>()

const { availableGifs } = useChatMedia()
const gifs = computed(() => availableGifs())

function pick(g: GifItem) {
  emit('select', g)
  emit('close')
}
</script>

<template>
  <Transition name="gif-slide">
    <div v-if="open" class="gif-picker">
      <div class="gif-picker-header">
        <span>GIF 表情</span>
        <button class="gif-close" @click="emit('close')" aria-label="关闭">×</button>
      </div>
      <div class="gif-grid">
        <div v-if="!gifs.length" class="gif-empty">
          暂无 GIF，点击图片按钮上传
        </div>
        <button
          v-for="g in gifs"
          :key="g.id"
          class="gif-item"
          :title="g.name"
          @click="pick(g)"
        >
          <img :src="g.url" :alt="g.name" loading="lazy" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="less">
.gif-picker {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.25);
  max-height: 220px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.gif-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}
.gif-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  &:hover { color: #fff; }
}
.gif-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 4px 8px 8px;
  overflow-y: auto;
  flex: 1;
}
.gif-item {
  border: none;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  &:hover { background: rgba(255, 255, 255, 0.12); }
  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
}
.gif-empty {
  grid-column: 1 / -1;
  text-align: center;
  color: rgba(255, 255, 255, 0.35);
  font-size: 13px;
  padding: 20px;
}
.gif-slide-enter-active,
.gif-slide-leave-active {
  transition: max-height 0.25s ease, opacity 0.2s;
  overflow: hidden;
}
.gif-slide-enter-from,
.gif-slide-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
