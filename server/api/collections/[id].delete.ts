import { updateCollections, updatePosts, getCollections } from '~~/server/utils/db'

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

  // Clean up collectedBy — but only for posts the user no longer holds in ANY
  // remaining collection (consistent with items.post.ts), preventing premature
  // count drift when a post is saved to multiple collections.
  const remaining = await getCollections()
  const stillHeld = new Set<string>()
  for (const c of remaining) {
    if (c.userId === user.id) {
      for (const pid of c.postIds) stillHeld.add(pid)
    }
  }
  for (const pid of postIds) {
    if (stillHeld.has(pid)) continue
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
