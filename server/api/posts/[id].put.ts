// PUT /api/posts/[id]
//
// 更新自己的帖子（管理员可更新任意帖子）。
// 仅允许修改 title / content / images / videos / tags；其余字段（likedBy /
// collectedBy / commentCount / createdAt / userId 等）保持不变。
// 复用与创建相同的 config 限额校验。
import { updatePosts } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { getConfig } from '~~/server/utils/appConfig'

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

  return await updatePosts((items) => {
    const idx = items.findIndex((p) => p.id === id)
    if (idx === -1) throw createError({ statusCode: 404, statusMessage: '帖子不存在' })
    if (items[idx].userId !== user.id && user.role !== 'admin') {
      throw createError({ statusCode: 403, statusMessage: '只能编辑自己的帖子' })
    }
    const post = items[idx]
    if (body.title !== undefined) post.title = body.title!
    if (body.content !== undefined) post.content = body.content!
    if (body.images !== undefined) post.images = body.images!
    if (body.videos !== undefined) post.videos = body.videos!
    if (body.tags !== undefined) post.tags = body.tags!
    post.updatedAt = Date.now()
    return post
  })
})
