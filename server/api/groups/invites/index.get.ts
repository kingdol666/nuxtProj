// GET /api/groups/invites → 收到的待处理群邀请（当前用户为被邀请方）
import { getGroupInvites } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const all = await getGroupInvites()
  return all
    .filter((inv) => inv.toUserId === user.id && inv.status === 'pending')
    .sort((a, b) => b.createdAt - a.createdAt)
})
