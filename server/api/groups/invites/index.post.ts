// POST /api/groups/invites  { groupId, toUserId } → 邀请好友进群（需对方同意）
// 校验：①邀请者是群成员 ②被邀请者与邀请者互为关注或粉丝（好友关系）③尚未在群内 ④无重复待处理邀请
// 成功后实时通知被邀请者（WS），等待其 accept/decline。
import { getGroups, updateGroupInvites, getFollows, getGroupInvites, genId, type GroupInvite } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { sendToUser } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ groupId?: string; toUserId?: string }>(event)
  const groupId = body?.groupId?.trim()
  const toUserId = body?.toUserId?.trim()
  if (!groupId) throw createError({ statusCode: 400, statusMessage: 'groupId is required' })
  if (!toUserId) throw createError({ statusCode: 400, statusMessage: 'toUserId is required' })
  if (toUserId === user.id) throw createError({ statusCode: 400, statusMessage: '不能邀请自己' })

  const [groups, follows, existing] = await Promise.all([getGroups(), getFollows(), getGroupInvites()])
  const g = groups.find((x) => x.id === groupId)
  if (!g) throw createError({ statusCode: 404, statusMessage: '群组不存在' })
  if (!g.memberIds.includes(user.id)) {
    throw createError({ statusCode: 403, statusMessage: '你不是该群成员，无法邀请' })
  }
  if (g.memberIds.includes(toUserId)) {
    throw createError({ statusCode: 400, statusMessage: '该用户已在群中' })
  }

  // 好友关系校验：必须是关注者或粉丝（单向即视为好友，满足"拉关注者或粉丝"需求）
  const isFriend = follows.some(
    (f) =>
      (f.followerId === user.id && f.followeeId === toUserId) ||
      (f.followerId === toUserId && f.followeeId === user.id),
  )
  if (!isFriend) {
    throw createError({ statusCode: 403, statusMessage: '只能邀请你的关注者或粉丝' })
  }

  // 无重复待处理邀请
  const dup = existing.some(
    (inv) => inv.groupId === groupId && inv.toUserId === toUserId && inv.status === 'pending',
  )
  if (dup) throw createError({ statusCode: 409, statusMessage: '已发送过邀请，等待对方同意' })

  const invite = await updateGroupInvites((items) => {
    const inv: GroupInvite = {
      id: genId(),
      groupId,
      groupName: g.name,
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId,
      status: 'pending',
      createdAt: Date.now(),
    }
    items.push(inv)
    return inv
  })

  // 实时通知被邀请者
  sendToUser(toUserId, {
    type: 'groupInvite',
    invite,
    createdAt: Date.now(),
  })

  return invite
})
