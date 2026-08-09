import { updateComments, genId } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ contentId?: string; text?: string; parentId?: string | null }>(event)
  const contentId = body?.contentId?.trim()
  const text = body?.text?.trim()

  if (!contentId) throw createError({ statusCode: 400, statusMessage: 'contentId is required' })
  if (!text) throw createError({ statusCode: 400, statusMessage: '评论内容不能为空' })
  if (text.length > 2000) throw createError({ statusCode: 400, statusMessage: '评论内容过长' })

  return await updateComments((items) => {
    const comment = {
      id: genId(),
      contentId,
      userId: user.id,
      username: user.username,
      avatarColor: user.avatarColor,
      text,
      parentId: body.parentId || null,
      likedBy: [] as string[],
      createdAt: Date.now(),
    }
    items.push(comment)
    return comment
  })
})
