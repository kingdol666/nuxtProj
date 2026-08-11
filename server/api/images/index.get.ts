// GET /api/images → list current user's uploaded images
// Optional: ?purpose=post|avatar|background to filter
import { getImages } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const purpose = query.purpose as string | undefined

  const all = await getImages()
  let mine = all.filter((img) => img.userId === user.id)
  if (purpose) mine = mine.filter((img) => img.purpose === purpose)

  return mine.sort((a, b) => b.createdAt - a.createdAt)
})
