import { updateComments, updatePosts } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })

  return await updateComments((items) => {
    const idx = items.findIndex((c) => c.id === id)
    if (idx === -1) throw createError({ statusCode: 404, statusMessage: '评论不存在' })
    if (items[idx].userId !== user.id && user.role !== 'admin') {
      throw createError({ statusCode: 403, statusMessage: '只能删除自己的评论' })
    }
    // Cascade: delete the comment and all its replies
    const toRemove = new Set([id])
    let changed = true
    while (changed) {
      changed = false
      for (const c of items) {
        if (c.parentId && toRemove.has(c.parentId) && !toRemove.has(c.id)) {
          toRemove.add(c.id)
          changed = true
        }
      }
    }
    const targetType = items[idx]?.targetType || 'content'
    const targetId = items[idx]?.contentId
    const next = items.filter((c) => !toRemove.has(c.id))
    items.length = 0
    items.push(...next)
    // Decrement commentCount on the target post if applicable
    if (targetType === 'post' && targetId) {
      updatePosts((posts) => {
        const p = posts.find((pp) => pp.id === targetId)
        if (p) p.commentCount = Math.max(0, p.commentCount - toRemove.size)
        return null
      })
    }
    return { success: true, deleted: toRemove.size }
  })
})
