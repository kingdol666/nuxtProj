// composables/useAvatar.ts
//
// 用户头像渐变配色：与 Header 保持一致的 6 色调色板。
// avatarColor (0-5) 索引到调色板，超出范围回退到 0。
import { computed } from '#imports'

export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#06b6d4,#3b82f6)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#10b981,#06b6d4)',
  'linear-gradient(135deg,#3b82f6,#6366f1)',
]

export const useAvatar = (avatarColor: () => number | undefined | null) => ({
  background: computed(() => AVATAR_GRADIENTS[(avatarColor() ?? 0) % AVATAR_GRADIENTS.length]).value,
})

export function avatarStyle(color: number | undefined | null) {
  return { background: AVATAR_GRADIENTS[(color ?? 0) % AVATAR_GRADIENTS.length] }
}

// Returns style for an avatar: if avatarUrl is set, use background-image;
// otherwise fall back to the color-based gradient.
export function avatarStyleFull(color: number | undefined | null, avatarUrl?: string) {
  if (avatarUrl) {
    return {
      backgroundImage: `url(${avatarUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return { background: AVATAR_GRADIENTS[(color ?? 0) % AVATAR_GRADIENTS.length] }
}
