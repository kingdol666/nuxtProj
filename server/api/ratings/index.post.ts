import { updateRatings, genId } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ contentId?: string; value?: number }>(event)
  const contentId = body?.contentId?.trim()
  const value = Number(body?.value)

  if (!contentId) throw createError({ statusCode: 400, statusMessage: 'contentId is required' })
  if (!value || value < 1 || value > 5) throw createError({ statusCode: 400, statusMessage: '评分需为 1-5' })

  return await updateRatings((items) => {
    const idx = items.findIndex((r) => r.contentId === contentId && r.userId === user.id)
    if (idx !== -1) {
      items[idx].value = value
      return items[idx]
    }
    const rating = {
      id: genId(),
      contentId,
      userId: user.id,
      value,
      createdAt: Date.now(),
    }
    items.push(rating)
    return rating
  })
})
