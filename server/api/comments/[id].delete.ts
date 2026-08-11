import { updateComments, updatePosts } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })

  const { targetType, targetId, count: deleted } = await updateComments((items) => {
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
    // Capture post linkage BEFORE mutating the array.
    const targetType = items[idx]?.targetType || 'content'
    const targetId = items[idx]?.contentId
    const count = toRemove.size
    const next = items.filter((c) => !toRemove.has(c.id))
    items.length = 0
    items.push(...next)
    return { targetType, targetId, count }
  })

  // Decrement commentCount on the target post outside the comment transaction.
  if (targetType === 'post' && targetId) {
    await updatePosts((posts) => {
      const p = posts.find((pp) => pp.id === targetId)
      if (p) p.commentCount = Math.max(0, p.commentCount - deleted)
      return null
    })
  }
  return { success: true, deleted }
})
