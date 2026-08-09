import { requireAdmin } from '~~/server/utils/auth'
import { updateTags, type Tag } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<Partial<Tag>>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }

  return await updateTags((items) => {
    const idx = items.findIndex((t) => t.id === id)
    if (idx === -1) {
      throw createError({ statusCode: 404, statusMessage: 'tag not found' })
    }
    items[idx] = { ...items[idx], ...body, id }
    return items[idx]
  })
})
