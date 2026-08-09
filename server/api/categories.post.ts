import { requireAdmin } from '~~/server/utils/auth'
import { updateCategories, genId, type Category } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<Category>(event)

  if (!body?.title?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'title is required' })
  }

  const created: Category = {
    id: genId(),
    title: body.title.trim(),
    title_zh: body.title_zh?.trim() || body.title.trim(),
    icon: body.icon?.trim() || 'AppstoreOutlined',
  }

  return await updateCategories((items) => {
    items.push(created)
    return created
  })
})
