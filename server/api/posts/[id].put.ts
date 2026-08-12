// PUT /api/posts/[id]
//
// 更新自己的帖子（管理员可更新任意帖子）。
// 仅允许修改 title / content / images / videos / tags；其余字段（likedBy /
// collectedBy / commentCount / createdAt / userId 等）保持不变。
// 复用与创建相同的 config 限额校验。
import { updatePosts, updateImages, genId, uploadsDir, type ImageMeta } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { getConfig } from '~~/server/utils/appConfig'
import { generateCoverImage } from '~~/server/utils/poster'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'


export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })

  const body = await readBody<{
    title?: string
    content?: string
    images?: string[]
    videos?: string[]
    tags?: string[]
    coverGradient?: number
    useCoverGen?: boolean
  }>(event)

  // 字段校验（与创建逻辑一致；仅在请求体提供该字段时校验）
  const cfg = getConfig().limits
  if (body.title !== undefined) {
    const title = body.title.trim()
    if (!title) throw createError({ statusCode: 400, statusMessage: '标题不能为空' })
    if (title.length > cfg.posts.titleMax) {
      throw createError({ statusCode: 400, statusMessage: `标题过长（最多${cfg.posts.titleMax}字）` })
    }
    body.title = title
  }
  if (body.content !== undefined) {
    const content = body.content.trim()
    if (!content) throw createError({ statusCode: 400, statusMessage: '内容不能为空' })
    if (content.length > cfg.posts.contentMax) {
      throw createError({ statusCode: 400, statusMessage: `内容过长（最多${cfg.posts.contentMax}字）` })
    }
    body.content = content
  }
  if (Array.isArray(body.images)) {
    body.images = body.images.filter((u) => typeof u === 'string' && u.length < 500).slice(0, cfg.uploads.maxMedia)
  }
  if (Array.isArray(body.videos)) {
    body.videos = body.videos.filter((u) => typeof u === 'string' && u.length < 500).slice(0, cfg.uploads.maxVideos)
  }
  if (Array.isArray(body.tags)) {
    body.tags = body.tags.filter((t) => typeof t === 'string' && t.length <= cfg.posts.tagMaxLen).slice(0, cfg.posts.maxTags)
  }

  // ── 第一步：同步更新字段，记录是否需要生成封面 ──
  const needGenCover = await updatePosts(async (items) => {
    const idx = items.findIndex((p) => p.id === id)
    if (idx === -1) throw createError({ statusCode: 404, statusMessage: '帖子不存在' })
    if (items[idx].userId !== user.id && user.role !== 'admin') {
      throw createError({ statusCode: 403, statusMessage: '只能编辑自己的帖子' })
    }
    const post = items[idx]
    if (body.title !== undefined) post.title = body.title!
    if (body.content !== undefined) post.content = body.content!
    if (body.tags !== undefined) post.tags = body.tags!
    if (body.videos !== undefined) post.videos = body.videos!
    if (body.images !== undefined) post.images = body.images!
    const hasVideo = body.videos !== undefined ? body.videos.length > 0 : (post.videos?.length ?? 0) > 0
    const mustGen = post.images.length === 0 && !hasVideo
    const wantGen = body.useCoverGen === true || mustGen
    post.updatedAt = Date.now()
    return wantGen
  })

  // ── 第二步：若需要生成封面，删除旧封面文件 + 生成新封面 + 插到第一位 ──
  if (needGenCover) {
    const updated = await updatePosts(async (items) => {
      const p = items.find((x) => x.id === id)
      if (!p) return p
      // 删除旧的自动封面文件（filename 含 cover 的）
      for (const url of p.images) {
        const fn = url.split('/').pop()
        if (fn && fn.includes('cover')) {
          await fs.unlink(join(uploadsDir(), fn)).catch(() => {})
        }
      }
      // 移除旧封面 URL，保留用户上传的图片
      const userImages = p.images.filter((url) => !url.split('/').pop()?.includes('cover'))
      // 生成新封面
      const gradientIndex = typeof body.coverGradient === 'number' ? body.coverGradient : -1
      const coverPng = await generateCoverImage({ title: p.title, content: p.content, tags: p.tags, gradientIndex })
      const filename = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}-cover.png`
      const dir = uploadsDir()
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(join(dir, filename), coverPng)
      // 新封面插到第一位，用户图片保留在后面
      p.images = [`/api/uploads/${filename}`, ...userImages]
      await updateImages((all) => {
        const meta: ImageMeta = {
          id: genId(), filename, originalName: `${p.title}-cover.png`, mimeType: 'image/png',
          kind: 'image', size: coverPng.length, width: 750, height: 1000, duration: 0,
          userId: user.id, purpose: 'post', url: p.images[0], createdAt: Date.now(),
        }
        all.push(meta)
        return meta
      })
      return p
    })
    return updated
  }

  return await updatePosts((items) => items.find((p) => p.id === id)!)
})
