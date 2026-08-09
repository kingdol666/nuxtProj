import { getComments } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const contentId = query.contentId as string | undefined
  let items = await getComments()
  if (contentId) items = items.filter((c) => c.contentId === contentId)
  // Sort: top-level by newest first; replies by oldest first (conversation order)
  return items.sort((a, b) => {
    if (a.parentId && !b.parentId) return 1
    if (!a.parentId && b.parentId) return -1
    if (a.parentId && b.parentId) return a.createdAt - b.createdAt
    return b.createdAt - a.createdAt
  })
})
