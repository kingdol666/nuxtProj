// POST /api/groups/invites/[id]  { action: 'accept' | 'decline' } → 同意/拒绝群邀请
// accept：把被邀请者加入群组成员 → 同步 WuKongIM 订阅者 → 通知邀请者
// decline：仅标记邀请为 declined
import { updateGroupInvites, updateGroups, type GroupInvite } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { syncGroupSubscribers } from '~~/server/utils/wukongim'
import { sendToUser } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const inviteId = getRouterParam(event, 'id')
  const body = await readBody<{ action?: 'accept' | 'decline' }>(event)
  const action = body?.action
  if (!inviteId) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  if (action !== 'accept' && action !== 'decline') {
    throw createError({ statusCode: 400, statusMessage: 'action 必须为 accept 或 decline' })
  }

  // 先更新邀请状态，拿到 invite 快照（accept 时用于入群）
  const invite = await updateGroupInvites((items) => {
    const idx = items.findIndex((inv) => inv.id === inviteId)
    if (idx === -1) throw createError({ statusCode: 404, statusMessage: '邀请不存在' })
    const inv = items[idx]
    if (inv.toUserId !== user.id) {
      throw createError({ statusCode: 403, statusMessage: '无权处理此邀请' })
    }
    if (inv.status !== 'pending') {
      throw createError({ statusCode: 400, statusMessage: '该邀请已处理' })
    }
    inv.status = action === 'accept' ? 'accepted' : 'declined'
    return inv
  })

  if (action === 'decline') {
    // 通知邀请者被拒绝（非必须，体验更好）
    sendToUser(invite.fromUserId, {
      type: 'groupInviteResult',
      accepted: false,
      groupId: invite.groupId,
      groupName: invite.groupName,
      toUserId: user.id,
      toUsername: user.username,
    })
    return { success: true, accepted: false }
  }

  // accept：加入群组
  const members = await updateGroups((items) => {
    const g = items.find((x) => x.id === invite.groupId)
    if (!g) throw createError({ statusCode: 404, statusMessage: '群组已解散' })
    if (!g.memberIds.includes(user.id)) g.memberIds.push(user.id)
    return g.memberIds
  })

  // 同步 WuKongIM 订阅者（新增成员后即可收发群消息）
  await syncGroupSubscribers(invite.groupId, members)

  // 通知邀请者已同意
  sendToUser(invite.fromUserId, {
    type: 'groupInviteResult',
    accepted: true,
    groupId: invite.groupId,
    groupName: invite.groupName,
    toUserId: user.id,
    toUsername: user.username,
  })

  return { success: true, accepted: true }
})
