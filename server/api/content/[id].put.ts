import { updateContent, type ContentItem } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody<Partial<ContentItem>>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }

  return await updateContent((items) => {
    const idx = items.findIndex((i) => i.id === id)
    if (idx === -1) {
      throw createError({ statusCode: 404, statusMessage: 'content not found' })
    }
    const updated = { ...items[idx], ...body, id }
    if (body.rating !== undefined) updated.rating = Number(body.rating)
    items[idx] = updated
    return updated
  })
})
