import { requireAdmin } from '~~/server/utils/auth'
import { updateTags, genId, type Tag } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<Tag>(event)
  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  const created: Tag = {
    id: genId(),
    name: body.name.trim(),
    name_zh: body.name_zh?.trim() || body.name.trim(),
    category: body.category?.trim() || '',
    category_zh: body.category_zh?.trim() || '',
  }

  return await updateTags((items) => {
    items.push(created)
    return created
  })
})
