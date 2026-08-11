// POST /api/posts — 创建帖子
// 与小红书一致：每篇笔记都有封面图。
//   - 上传了图片：用户可选的封面（coverImage 字段）或默认首张图
//   - 未上传图片：根据标题/正文/标签自动生成封面大图（渐变配色可自定义）
import { updatePosts, genId } from '~~/server/utils/db'
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
    coverGradient?: number  // 用户选择的自动封面配色索引（-1 = 按标题哈希）
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

  // ── 无图片时自动生成封面大图（小红书逻辑）──
  if (images.length === 0) {
    const gradientIndex = typeof body?.coverGradient === 'number' ? body.coverGradient : -1
    const coverPng = await generateCoverImage({ title, content, tags, gradientIndex })
    const filename = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}-cover.png`
    const dir = uploadsDir()
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(join(dir, filename), coverPng)
    images = [`/api/uploads/${filename}`]
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
