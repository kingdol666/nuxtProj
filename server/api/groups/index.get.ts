// GET /api/groups → 当前用户加入的所有群组（按最新创建在前）
import { getGroups } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const all = await getGroups()
  return all
    .filter((g) => g.memberIds.includes(user.id))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((g) => ({
      id: g.id,
      name: g.name,
      avatarColor: g.avatarColor,
      ownerId: g.ownerId,
      memberCount: g.memberIds.length,
      createdAt: g.createdAt,
      isOwner: g.ownerId === user.id,
    }))
})
