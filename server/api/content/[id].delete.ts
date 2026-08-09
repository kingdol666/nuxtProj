import { requireAdmin } from '~~/server/utils/auth'
import { updateContent } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }

  return await updateContent((items) => {
    const idx = items.findIndex((i) => i.id === id)
    if (idx === -1) {
      throw createError({ statusCode: 404, statusMessage: 'content not found' })
    }
    items.splice(idx, 1)
    return { success: true }
  })
})
