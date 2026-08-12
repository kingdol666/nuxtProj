// POST /api/groups  { name } → 创建群聊
// 创建者成为群主 + 初始成员；同步创建 WuKongIM 群组频道。
import { updateGroups, genId, type Group } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { createGroupChannel } from '~~/server/utils/wukongim'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ name?: string }>(event)
  const name = body?.name?.trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: '群名称不能为空' })
  if (name.length > 40) throw createError({ statusCode: 400, statusMessage: '群名称最多 40 字' })

  const group = await updateGroups((items) => {
    const g: Group = {
      id: genId(),
      name,
      avatarColor: Math.floor(Math.random() * 6),
      ownerId: user.id,
      memberIds: [user.id],
      createdAt: Date.now(),
    }
    items.push(g)
    return g
  })

  // 同步到 WuKongIM（不可达则软失败，客户端仍可重连后发消息）
  await createGroupChannel(group.id, group.memberIds)

  return group
})
