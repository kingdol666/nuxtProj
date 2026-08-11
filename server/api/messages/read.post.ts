// POST /api/messages/read { peerId } → mark all messages from peerId as read
import { updateMessages } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ peerId?: string }>(event)
  const peerId = body?.peerId?.trim()
  if (!peerId) throw createError({ statusCode: 400, statusMessage: 'peerId is required' })

  await updateMessages((items) => {
    let changed = 0
    for (const m of items) {
      if (m.fromUserId === peerId && m.toUserId === user.id && !m.read) {
        m.read = true
        changed += 1
      }
    }
    return { marked: changed }
  })

  return { success: true }
})
