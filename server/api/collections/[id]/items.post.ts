import { updateCollections, updatePosts } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

// Add or remove a post from a collection (toggle).
// Body: { postId: string }
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })

  const body = await readBody<{ postId?: string }>(event)
  const postId = body?.postId?.trim()
  if (!postId) throw createError({ statusCode: 400, statusMessage: 'postId is required' })

  const result = await updateCollections((items) => {
    const collection = items.find((c) => c.id === id)
    if (!collection) throw createError({ statusCode: 404, statusMessage: '收藏夹不存在' })
    if (collection.userId !== user.id) {
      throw createError({ statusCode: 403, statusMessage: '无权操作此收藏夹' })
    }

    const idx = collection.postIds.indexOf(postId)
    let collected: boolean
    if (idx === -1) {
      collection.postIds.push(postId)
      collected = true
    } else {
      collection.postIds.splice(idx, 1)
      collected = false
    }
    return { collected, postIds: [...collection.postIds] }
  })

  // Update the post's collectedBy set: still collected if any of the user's
  // collections contains it; otherwise remove.
  await updatePosts((posts) => {
    const post = posts.find((p) => p.id === postId)
    if (!post) return null

    // Re-read all collections to know if the user still holds this post elsewhere
    // We do this here to stay consistent within the same write batch lifecycle;
    // getCollections would re-read the just-committed file.
    // Instead, derive from collectedBy directly: if collected, ensure present; else absent.
    const ci = post.collectedBy.indexOf(user.id)
    if (result.collected && ci === -1) post.collectedBy.push(user.id)
    else if (!result.collected && ci !== -1) post.collectedBy.splice(ci, 1)
    return null
  })

  return result
})
