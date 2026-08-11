import { updateCollections, genId } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ name?: string; description?: string }>(event)

  const name = body?.name?.trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: '收藏夹名称不能为空' })
  if (name.length > 30) throw createError({ statusCode: 400, statusMessage: '收藏夹名称过长（最多30字）' })

  const description = body?.description?.trim() || ''

  return await updateCollections((items) => {
    const collection = {
      id: genId(),
      userId: user.id,
      name,
      description,
      postIds: [] as string[],
      createdAt: Date.now(),
    }
    items.push(collection)
    return collection
  })
})
