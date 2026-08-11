import { updateComments, updatePosts, genId } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { getConfig } from '~~/server/utils/appConfig'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ contentId?: string; text?: string; parentId?: string | null; targetType?: 'content' | 'post' }>(event)
  const contentId = body?.contentId?.trim()
  const text = body?.text?.trim()

  if (!contentId) throw createError({ statusCode: 400, statusMessage: 'contentId is required' })
  if (!text) throw createError({ statusCode: 400, statusMessage: '评论内容不能为空' })
  if (text.length > getConfig().limits.comments.textMax) throw createError({ statusCode: 400, statusMessage: '评论内容过长' })

  const comment = await updateComments((items) => {
    const c = {
      id: genId(),
      contentId,
      userId: user.id,
      username: user.username,
      avatarColor: user.avatarColor,
      text,
      parentId: body.parentId || null,
      targetType: (body.targetType === 'post' ? 'post' : 'content') as 'content' | 'post',
      likedBy: [] as string[],
      createdAt: Date.now(),
    }
    items.push(c)
    return c
  })

  // Increment commentCount on the target post (outside the comment transaction
  // so the two writes don't race and the count is durable).
  if (comment.targetType === 'post') {
    await updatePosts((posts) => {
      const p = posts.find((pp) => pp.id === contentId)
      if (p) p.commentCount += 1
      return null
    })
  }
  return comment
})
