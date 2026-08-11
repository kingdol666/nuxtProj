// POST /api/messages { toUserId, text } → { message }
// Persists the message. If recipient is online → push via WS + mark delivered.
// If offline → stored with delivered:false (consumed on next connect).
import { updateMessages, genId, getUsers, type Message } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { sendToUser, isOnline } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ toUserId?: string; text?: string }>(event)
  const toUserId = body?.toUserId?.trim()
  const text = body?.text?.trim()

  if (!toUserId) throw createError({ statusCode: 400, statusMessage: 'toUserId is required' })
  if (!text) throw createError({ statusCode: 400, statusMessage: '消息不能为空' })
  if (text.length > 1000) throw createError({ statusCode: 400, statusMessage: '消息过长（最多1000字）' })
  if (toUserId === user.id) throw createError({ statusCode: 400, statusMessage: '不能给自己发私信' })

  // Validate recipient exists
  const users = await getUsers()
  if (!users.some((u) => u.id === toUserId)) {
    throw createError({ statusCode: 404, statusMessage: '用户不存在' })
  }

  const now = Date.now()
  const online = isOnline(toUserId)

  const message: Message = await updateMessages((items) => {
    const msg: Message = {
      id: genId(),
      fromUserId: user.id,
      toUserId,
      text,
      read: false,
      delivered: online,
      createdAt: now,
    }
    items.push(msg)
    return msg
  })

  // Real-time push (best-effort). If it fails (peer gone between check & send),
  // the message stays delivered:false and will be drained on reconnect.
  if (online) {
    const ok = sendToUser(toUserId, { type: 'message', message })
    if (!ok) {
      // Peer vanished — mark undelivered so it drains later
      await updateMessages((items) => {
        const m = items.find((x) => x.id === message.id)
        if (m) m.delivered = false
        return null
      })
    }
  }

  return { message }
})
