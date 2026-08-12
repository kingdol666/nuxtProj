// GET /api/groups/[id] → 群组详情 + 成员公开资料（仅成员可见）
import { getGroups, getUsers } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })

  const all = await getGroups()
  const g = all.find((x) => x.id === id)
  if (!g) throw createError({ statusCode: 404, statusMessage: '群组不存在' })
  if (!g.memberIds.includes(user.id)) {
    throw createError({ statusCode: 403, statusMessage: '你不是该群成员' })
  }

  const users = await getUsers()
  const members = g.memberIds
    .map((mid) => users.find((u) => u.id === mid))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map((u) => ({
      id: u.id,
      username: u.username,
      avatarColor: u.avatarColor,
      avatarUrl: u.avatarUrl || '',
      bio: u.bio || '',
      isOwner: u.id === g.ownerId,
      isMe: u.id === user.id,
    }))

  return {
    id: g.id,
    name: g.name,
    avatarColor: g.avatarColor,
    ownerId: g.ownerId,
    createdAt: g.createdAt,
    isOwner: g.ownerId === user.id,
    members,
  }
})
