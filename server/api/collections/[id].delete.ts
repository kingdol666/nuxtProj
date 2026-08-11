import { updateCollections, updatePosts } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })

  const { postIds } = await updateCollections((items) => {
    const idx = items.findIndex((c) => c.id === id)
    if (idx === -1) throw createError({ statusCode: 404, statusMessage: '收藏夹不存在' })
    if (items[idx].userId !== user.id) {
      throw createError({ statusCode: 403, statusMessage: '只能删除自己的收藏夹' })
    }
    const removedPostIds = items[idx].postIds
    items.splice(idx, 1)
    return { postIds: removedPostIds }
  })

  // Clean up collectedBy references on posts
  for (const pid of postIds) {
    await updatePosts((posts) => {
      const p = posts.find((pp) => pp.id === pid)
      if (p) {
        const i = p.collectedBy.indexOf(user.id)
        if (i !== -1) p.collectedBy.splice(i, 1)
      }
      return null
    })
  }

  return { success: true }
})
