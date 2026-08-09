import { getRatings } from '~~/server/utils/db'
import { getUserFromEvent } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const contentId = query.contentId as string | undefined
  if (!contentId) throw createError({ statusCode: 400, statusMessage: 'contentId is required' })

  const all = await getRatings()
  const forContent = all.filter((r) => r.contentId === contentId)

  const user = await getUserFromEvent(event)
  const userRating = user ? forContent.find((r) => r.userId === user.id)?.value ?? 0 : 0
  const avg = forContent.length
    ? Math.round((forContent.reduce((s, r) => s + r.value, 0) / forContent.length) * 10) / 10
    : 0

  return { avg, count: forContent.length, userRating }
})
