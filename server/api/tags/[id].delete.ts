import { updateTags } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }

  return await updateTags((items) => {
    const idx = items.findIndex((t) => t.id === id)
    if (idx === -1) {
      throw createError({ statusCode: 404, statusMessage: 'tag not found' })
    }
    items.splice(idx, 1)
    return { success: true }
  })
})
