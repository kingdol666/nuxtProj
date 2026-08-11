import { getCollections } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const items = await getCollections()
  return items
    .filter((c) => c.userId === user.id)
    .sort((a, b) => b.createdAt - a.createdAt)
})
