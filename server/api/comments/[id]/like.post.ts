import { updateComments } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })

  return await updateComments((items) => {
    const comment = items.find((c) => c.id === id)
    if (!comment) throw createError({ statusCode: 404, statusMessage: '评论不存在' })
    // 不能给自己的评论点赞
    if (comment.userId === user.id) {
      throw createError({ statusCode: 403, statusMessage: '不能给自己的评论点赞' })
    }
    const idx = comment.likedBy.indexOf(user.id)
    if (idx === -1) {
      comment.likedBy.push(user.id)
    } else {
      comment.likedBy.splice(idx, 1)
    }
    return { id: comment.id, liked: idx === -1, likeCount: comment.likedBy.length }
  })
})
