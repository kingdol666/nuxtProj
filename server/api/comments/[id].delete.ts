import { updateComments, updatePosts } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })

  const { targetId, postDecrement, deleted } = await updateComments((items) => {
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
    const targetId = items[idx]?.contentId
    // Only removed comments that count toward THIS post's counter decrement it
    // — a reply tree could otherwise span different targets and over-subtract.
    const postDecrement = items.filter(
      (c) => toRemove.has(c.id) && (c.targetType || 'content') === 'post' && c.contentId === targetId
    ).length
    const next = items.filter((c) => !toRemove.has(c.id))
    items.length = 0
    items.push(...next)
    return { targetId, postDecrement, deleted: toRemove.size }
  })

  // Decrement commentCount on the target post outside the comment transaction.
  if (targetId && postDecrement > 0) {
    await updatePosts((posts) => {
      const p = posts.find((pp) => pp.id === targetId)
      if (p) p.commentCount = Math.max(0, p.commentCount - postDecrement)
      return null
    })
  }
  return { success: true, deleted }
})
