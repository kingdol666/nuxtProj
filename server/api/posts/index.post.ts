// POST /api/posts — 创建帖子
// 与小红书一致：每篇笔记都有封面图。
//   - 上传了图片：用户可选的封面（首张图）
//   - 未上传图片：根据标题/正文/标签自动生成封面大图（渐变配色可自定义）
//   - 自动封面写入 uploads 目录 + images.json 元数据，可持久查找
import { updatePosts, updateImages, genId, type ImageMeta } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { getConfig } from '~~/server/utils/appConfig'
import { generateCoverImage } from '~~/server/utils/poster'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

function uploadsDir(): string {
  return join(process.env.NUXT_DATA_DIR || join(process.cwd(), 'data'), 'uploads')
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{
    title?: string
    content?: string
    images?: string[]
    videos?: string[]
    tags?: string[]
    coverGradient?: number
    useCoverGen?: boolean
  }>(event)
  const title = body?.title?.trim()
  const content = body?.content?.trim()
  if (!title) throw createError({ statusCode: 400, statusMessage: '标题不能为空' })
  if (!content) throw createError({ statusCode: 400, statusMessage: '内容不能为空' })
  const cfg = getConfig().limits
  if (title.length > cfg.posts.titleMax) throw createError({ statusCode: 400, statusMessage: `标题过长（最多${cfg.posts.titleMax}字）` })
  if (content.length > cfg.posts.contentMax) throw createError({ statusCode: 400, statusMessage: `内容过长（最多${cfg.posts.contentMax}字）` })

  let images = Array.isArray(body?.images) ? body.images.filter((u) => typeof u === 'string' && u.length < 500).slice(0, cfg.uploads.maxMedia) : []
  const videos = Array.isArray(body?.videos) ? body.videos.filter((u) => typeof u === 'string' && u.length < 500).slice(0, cfg.uploads.maxVideos) : []
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t) => typeof t === 'string' && t.length <= cfg.posts.tagMaxLen).slice(0, cfg.posts.maxTags) : []

  // ── 封面生成逻辑 ──
  // useCoverGen=true → 生成主题封面插到 images[0]，用户上传的图片保留在后面
  // 无图片时强制生成
  const mustGenCover = images.length === 0
  const wantGenCover = body?.useCoverGen === true || mustGenCover
  if (wantGenCover) {
    const gradientIndex = typeof body?.coverGradient === 'number' ? body.coverGradient : -1
    const coverPng = await generateCoverImage({ title, content, tags, gradientIndex })
    const filename = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}-cover.png`
    const dir = uploadsDir()
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(join(dir, filename), coverPng)
    const coverUrl = `/api/uploads/${filename}`
    // 生成的封面插到第一位，用户图片保留在后面（共存）
    images = [coverUrl, ...images]
    await updateImages((items) => {
      const meta: ImageMeta = {
        id: genId(), filename, originalName: `${title}-cover.png`, mimeType: 'image/png',
        kind: 'image', size: coverPng.length, width: 750, height: 1000, duration: 0,
        userId: user.id, purpose: 'post', url: coverUrl, createdAt: Date.now(),
      }
      items.push(meta)
      return meta
    })
  }

  const now = Date.now()
  return await updatePosts((items) => {
    const post = {
      id: genId(),
      userId: user.id,
      username: user.username,
      avatarColor: user.avatarColor,
      title,
      content,
      images,
      videos,
      tags,
      likedBy: [] as string[],
      collectedBy: [] as string[],
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    items.unshift(post)
    return post
  })
})
