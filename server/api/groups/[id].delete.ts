// DELETE /api/groups/[id] → 退群；群主退群 = 解散（需确认）
// 退群后同步 WuKongIM 订阅者；解散则从 groups.json 移除。
import { updateGroups } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { syncGroupSubscribers } from '~~/server/utils/wukongim'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })

  const result = await updateGroups((items) => {
    const idx = items.findIndex((g) => g.id === id)
    if (idx === -1) throw createError({ statusCode: 404, statusMessage: '群组不存在' })
    const g = items[idx]
    if (!g.memberIds.includes(user.id)) {
      throw createError({ statusCode: 403, statusMessage: '你不是该群成员' })
    }

    // 群主退群 → 解散群组
    if (g.ownerId === user.id) {
      items.splice(idx, 1)
      return { dissolved: true, remaining: [] as string[], name: g.name }
    }

    // 普通成员退群
    g.memberIds = g.memberIds.filter((mid) => mid !== user.id)
    return { dissolved: false, remaining: g.memberIds, name: g.name }
  })

  // 同步 WuKongIM 订阅者（解散时置空）
  await syncGroupSubscribers(id, result.remaining)
  return { success: true, dissolved: result.dissolved }
})
