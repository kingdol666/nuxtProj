import { updatePosts, genId } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { getConfig } from '~~/server/utils/appConfig'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{
    title?: string
    content?: string
    images?: string[]
    videos?: string[]
    tags?: string[]
  }>(event)

  const title = body?.title?.trim()
  const content = body?.content?.trim()
  if (!title) throw createError({ statusCode: 400, statusMessage: '标题不能为空' })
  if (!content) throw createError({ statusCode: 400, statusMessage: '内容不能为空' })
  const cfg = getConfig().limits
  if (title.length > cfg.posts.titleMax) throw createError({ statusCode: 400, statusMessage: `标题过长（最多${cfg.posts.titleMax}字）` })
  if (content.length > cfg.posts.contentMax) throw createError({ statusCode: 400, statusMessage: `内容过长（最多${cfg.posts.contentMax}字）` })

  const images = Array.isArray(body?.images) ? body.images.filter((u) => typeof u === 'string' && u.length < 500).slice(0, cfg.uploads.maxMedia) : []
  const videos = Array.isArray(body?.videos) ? body.videos.filter((u) => typeof u === 'string' && u.length < 500).slice(0, cfg.uploads.maxVideos) : []
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t) => typeof t === 'string' && t.length <= cfg.posts.tagMaxLen).slice(0, cfg.posts.maxTags) : []
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
