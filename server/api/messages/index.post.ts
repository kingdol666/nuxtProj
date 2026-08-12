// POST /api/messages { toUserId, text?, msgType?, mediaUrl?, mediaW?, mediaH?, viaWK? } → { message }
// Persists the message. If recipient is online → push via WS + mark delivered.
// If offline → stored with delivered:false (consumed on next connect).
// msgType: 1=文本(默认)  2=图片  3=GIF
import { updateMessages, genId, getUsers, type Message } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { sendToUser, isOnline } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{
    toUserId?: string; text?: string; viaWK?: boolean
    msgType?: 1 | 2 | 3; mediaUrl?: string; mediaW?: number; mediaH?: number
  }>(event)
  const toUserId = body?.toUserId?.trim()
  const text = body?.text?.trim() ?? ''
  const viaWK = !!body?.viaWK
  const msgType: 1 | 2 | 3 = body?.msgType ?? 1
  const mediaUrl = body?.mediaUrl?.trim() ?? ''
  const mediaW = Number(body?.mediaW) || 0
  const mediaH = Number(body?.mediaH) || 0

  if (!toUserId) throw createError({ statusCode: 400, statusMessage: 'toUserId is required' })
  // 文本消息必须有内容；图片/GIF 必须有 url
  if (msgType === 1 && !text) throw createError({ statusCode: 400, statusMessage: '消息不能为空' })
  if (msgType !== 1 && !mediaUrl) throw createError({ statusCode: 400, statusMessage: '媒体地址缺失' })
  if (text.length > 1000) throw createError({ statusCode: 400, statusMessage: '消息过长（最多1000字）' })
  if (toUserId === user.id) throw createError({ statusCode: 400, statusMessage: '不能给自己发私信' })

  // Validate recipient exists
  const users = await getUsers()
  if (!users.some((u) => u.id === toUserId)) {
    throw createError({ statusCode: 404, statusMessage: '用户不存在' })
  }

  const now = Date.now()
  // viaWK=true: 消息已由 WuKongIM 实时投递 → 标记 delivered + 跳过 WS 推送
  // viaWK=false: WuKongIM 不可用 → 走自有 WS 推送（降级路径）
  const online = viaWK || isOnline(toUserId)

  const message: Message = await updateMessages((items) => {
    const msg: Message = {
      id: genId(),
      fromUserId: user.id,
      toUserId,
      text,
      read: false,
      delivered: online,
      createdAt: now,
      msgType,
      mediaUrl,
      mediaW,
      mediaH,
    }
    items.push(msg)
    return msg
  })

  // 仅在降级路径（非 WuKongIM）走 WS 推送
  if (!viaWK && online) {
    const ok = sendToUser(toUserId, { type: 'message', message })
    if (!ok) {
      await updateMessages((items) => {
        const m = items.find((x) => x.id === message.id)
        if (m) m.delivered = false
        return null
      })
    }
  }

  return { message }
})
