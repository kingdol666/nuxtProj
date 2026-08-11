import { updatePosts } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })

  return await updatePosts((items) => {
    const idx = items.findIndex((p) => p.id === id)
    if (idx === -1) throw createError({ statusCode: 404, statusMessage: '帖子不存在' })
    if (items[idx].userId !== user.id && user.role !== 'admin') {
      throw createError({ statusCode: 403, statusMessage: '只能删除自己的帖子' })
    }
    items.splice(idx, 1)
    return { success: true }
  })
})
