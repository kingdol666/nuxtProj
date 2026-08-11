import { updatePosts } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })

  const result = await updatePosts((items) => {
    const post = items.find((p) => p.id === id)
    if (!post) throw createError({ statusCode: 404, statusMessage: '帖子不存在' })
    // 不能给自己的帖子点赞
    if (post.userId === user.id) {
      throw createError({ statusCode: 403, statusMessage: '不能给自己的帖子点赞' })
    }
    const idx = post.likedBy.indexOf(user.id)
    if (idx === -1) {
      post.likedBy.push(user.id)
    } else {
      post.likedBy.splice(idx, 1)
    }
    return { liked: idx === -1, likeCount: post.likedBy.length }
  })

  return result
})
