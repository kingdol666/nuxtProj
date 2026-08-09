import { updateContent, genId, type ContentItem } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<ContentItem>(event)

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  const created: ContentItem = {
    id: genId(),
    category: body.category?.trim() || 'Uncategorized',
    category_zh: body.category_zh?.trim() || '未分类',
    subCategory: body.subCategory?.trim() || 'General',
    subCategory_zh: body.subCategory_zh?.trim() || '通用',
    name: body.name.trim(),
    name_zh: body.name_zh?.trim() || body.name.trim(),
    content: body.content?.trim() || '',
    content_zh: body.content_zh?.trim() || body.content?.trim() || '',
    detail: body.detail?.trim() || '',
    detail_zh: body.detail_zh?.trim() || body.detail?.trim() || '',
    url: body.url?.trim() || '',
    rating: Number(body.rating) || 0,
  }

  return await updateContent((items) => {
    items.push(created)
    return created
  })
})
