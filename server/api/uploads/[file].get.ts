// server/api/uploads/[file].get.ts
//
// 静态媒体服务：从 data/uploads/ 读取文件并返回。
// 支持图片 + 视频。视频支持 HTTP Range 请求（拖拽跳转/流式播放）。
// 路径穿越防护 + MIME 映射 + 长缓存。
import { promises as fs } from 'node:fs'
import { join, extname } from 'node:path'

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogg': 'video/ogg',
  '.ogv': 'video/ogg',
}

const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.ogg', '.ogv'])

function uploadsDir(): string {
  let configured = ''
  try {
    const dir = useRuntimeConfig().dataDir
    if (typeof dir === 'string') configured = dir
  } catch {
    configured = ''
  }
  const base = configured || process.env.NUXT_DATA_DIR || join(process.cwd(), 'data')
  return join(base, 'uploads')
}

export default defineEventHandler(async (event) => {
  const file = getRouterParam(event, 'file')
  if (!file) throw createError({ statusCode: 400, statusMessage: 'file is required' })

  // Path traversal protection
  if (!/^[\w.\-]+$/.test(file)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid filename' })
  }

  const ext = extname(file).toLowerCase()
  if (!MIME[ext]) {
    throw createError({ statusCode: 415, statusMessage: 'unsupported file type' })
  }

  const filePath = join(uploadsDir(), file)

  // For videos, support HTTP Range requests for streaming/seeking
  const rangeHeader = getRequestHeader(event, 'range')
  const isVideo = VIDEO_EXT.has(ext)

  try {
    if (isVideo && rangeHeader) {
      // Parse Range: bytes=start-end
      const stat = await fs.stat(filePath)
      const fileSize = stat.size
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/)
      const start = match?.[1] ? parseInt(match[1], 10) : 0
      const end = match?.[2] ? parseInt(match[2], 10) : fileSize - 1
      const clampedEnd = Math.min(end, fileSize - 1)
      const chunkSize = clampedEnd - start + 1

      if (start >= fileSize || clampedEnd < start) {
        setResponseStatus(event, 416)
        setHeader(event, 'Content-Range', `bytes */${fileSize}`)
        return null
      }

      const fd = await fs.open(filePath, 'r')
      try {
        const buf = Buffer.alloc(chunkSize)
        await fd.read(buf, 0, chunkSize, start)
        setResponseStatus(event, 206)
        setHeader(event, 'Content-Type', MIME[ext])
        setHeader(event, 'Content-Length', String(chunkSize))
        setHeader(event, 'Content-Range', `bytes ${start}-${clampedEnd}/${fileSize}`)
        setHeader(event, 'Accept-Ranges', 'bytes')
        setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
        return buf
      } finally {
        await fd.close()
      }
    }

    // Full file read (images, or video without Range header)
    const data = await fs.readFile(filePath)
    setHeader(event, 'Content-Type', MIME[ext])
    setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
    if (isVideo) {
      setHeader(event, 'Accept-Ranges', 'bytes')
    }
    return data
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'file not found' })
  }
})
