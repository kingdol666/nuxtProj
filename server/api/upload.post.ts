// 媒体上传（图片 + 视频）：将文件持久化存储到 data/uploads/，
// 同时在 images.json 中记录结构化元信息。
// 查询参数 ?purpose=post|avatar|background 标记用途。
// 上传限额（图片/视频体积、数量）由 config.yml 热驱动。
import { promises as fs } from 'node:fs'
import { join, extname } from 'node:path'
import { randomBytes } from 'node:crypto'
import { requireUser } from '~~/server/utils/auth'
import { updateImages, genId, type ImageMeta } from '~~/server/utils/db'
import { readImageDimensions } from '~~/server/utils/imageMeta'
import { getConfig } from '~~/server/utils/appConfig'


const IMAGE_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
}
const VIDEO_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogg': 'video/ogg',
  '.ogv': 'video/ogg',
}
const VALID_PURPOSES = new Set(['post', 'avatar', 'background', 'other'])

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
  const user = await requireUser(event)

  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: '未找到上传文件' })
  }

  const file = parts.find((p) => p.name === 'file')
  if (!file || !file.filename) {
    throw createError({ statusCode: 400, statusMessage: '未找到文件字段 "file"' })
  }

  const ext = extname(file.filename).toLowerCase()
  const imageMime = IMAGE_EXT[ext]
  const videoMime = VIDEO_EXT[ext]
  const mimeType = imageMime || videoMime
  if (!mimeType) {
    throw createError({ statusCode: 400, statusMessage: `不支持的文件类型: ${ext}` })
  }

  const kind: 'image' | 'video' = videoMime ? 'video' : 'image'
  const cfg = getConfig().limits.uploads
  const maxSize = (kind === 'video' ? cfg.maxVideoSizeMB : cfg.maxImageSizeMB) * MB
  if (file.data.length > maxSize) {
    throw createError({
      statusCode: 413,
      statusMessage: kind === 'video'
        ? `视频过大（最大 ${cfg.maxVideoSizeMB}MB）`
        : `图片过大（最大 ${cfg.maxImageSizeMB}MB）`,
    })
  }

  const query = getQuery(event)
  const purpose = VALID_PURPOSES.has(query.purpose as string)
    ? (query.purpose as ImageMeta['purpose'])
    : 'other'

  // Read image dimensions (only for images; videos get 0x0 — browser handles sizing)
  const { width, height } = kind === 'image'
    ? readImageDimensions(file.data, mimeType)
    : { width: 0, height: 0 }

  // Persist file to disk
  const dir = uploadsDir()
  await fs.mkdir(dir, { recursive: true })
  const filename = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}${ext}`
  await fs.writeFile(join(dir, filename), file.data)

  // Record structured metadata
  const url = `/api/uploads/${filename}`
  const meta = await updateImages((items) => {
    const record: ImageMeta = {
      id: genId(),
      filename,
      originalName: file.filename!,
      mimeType,
      kind,
      size: file.data.length,
      width,
      height,
      duration: 0,
      userId: user.id,
      purpose,
      url,
      createdAt: Date.now(),
    }
    items.push(record)
    return record
  })

  return {
    url: meta.url,
    filename: meta.filename,
    id: meta.id,
    kind: meta.kind,
    width,
    height,
  }
})
