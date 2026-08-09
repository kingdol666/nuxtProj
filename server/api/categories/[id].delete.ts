import { updateCategories } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }

  return await updateCategories((items) => {
    const idx = items.findIndex((c) => c.id === id)
    if (idx === -1) {
      throw createError({ statusCode: 404, statusMessage: 'category not found' })
    }
    items.splice(idx, 1)
    return { success: true }
  })
})
