// composables/useChatMedia.ts
//
// 聊天媒体上传与 GIF 库管理。
import { apiError } from './useApiError'
//   1. 上传图片/GIF 文件（复用 /api/upload）
//   2. 判定文件类型 → 返回对应的 MsgType
//   3. 提供内置 GIF 表情库（静态清单，用户也可自行上传 .gif）
import { useState } from '#imports'
import { MSG_IMAGE, MSG_GIF, MSG_TEXT } from './useWuKongIM'

export interface GifItem {
  id: string
  url: string
  name: string
}

// 内置 GIF 库（public/chat/gifs/ 下的静态文件）
// 用户也可通过上传按钮发送自己的 GIF。
export const BUILTIN_GIFS: GifItem[] = [
  { id: 'g_chat', url: '/chat/gifs/chat.gif', name: '聊天' },
  { id: 'g_feed', url: '/chat/gifs/feed.gif', name: '动态' },
  { id: 'g_hero', url: '/chat/gifs/hero.gif', name: '首页' },
]

const IMAGE_EXTS: Record<string, true> = {
  '.jpg': true, '.jpeg': true, '.png': true, '.webp': true, '.bmp': true,
}
const GIF_EXT = '.gif'

/** 从文件名判定消息类型 */
export function fileMsgType(filename: string): 1 | 2 | 3 {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  if (ext === GIF_EXT) return MSG_GIF
  if (IMAGE_EXTS[ext]) return MSG_IMAGE
  return MSG_TEXT
}

export interface UploadedMedia {
  url: string
  width: number
  height: number
  msgType: 2 | 3  // upload 仅处理图片/GIF（服务端已校验扩展名）
}

export const useChatMedia = () => {
  const uploading = useState<boolean>('chat-media-uploading', () => false)
  const error = useState<string>('chat-media-error', () => '')
  // 用户在本次会话上传的 GIF（追加到内置库之后）
  const userGifs = useState<GifItem[]>('chat-user-gifs', () => [])

  /** 所有可选 GIF（内置 + 用户上传） */
  const availableGifs = (): GifItem[] => [...BUILTIN_GIFS, ...userGifs.value]

  /**
   * 上传图片/GIF 文件。
   * @param file 浏览器 File 对象
   * @returns 上传结果（url、宽高、消息类型）
   */
  async function upload(file: File): Promise<UploadedMedia | null> {
    if (!file) return null
    uploading.value = true
    error.value = ''
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await $fetch<{
        url: string; filename: string; id: string
        kind: 'image' | 'video'; width: number; height: number
      }>('/api/upload?purpose=other', { method: 'POST', body: form })

      const msgType = fileMsgType(file.name)
      // 如果是 GIF，加入用户 GIF 库
      if (msgType === MSG_GIF) {
        userGifs.value = [...userGifs.value, {
          id: res.id, url: res.url, name: file.name,
        }]
      }
      return { url: res.url, width: res.width, height: res.height, msgType: msgType as 2 | 3 }
    } catch (e: unknown) {
      error.value = apiError(e, '上传失败')
      return null
    } finally {
      uploading.value = false
    }
  }

  return { uploading, error, upload, availableGifs, userGifs }
}
