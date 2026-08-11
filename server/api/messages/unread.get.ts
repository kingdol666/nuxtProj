// GET /api/messages/unread → { count } total unread messages addressed to me
import { getMessages } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const all = await getMessages()
  const count = all.filter((m) => m.toUserId === user.id && !m.read).length
  return { count }
})
