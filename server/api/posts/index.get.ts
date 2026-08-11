import { getPosts } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const tag = query.tag as string | undefined
  const userId = query.userId as string | undefined
  const keyword = query.keyword as string | undefined

  let items = await getPosts()

  if (tag) items = items.filter((p) => p.tags.includes(tag))
  if (userId) items = items.filter((p) => p.userId === userId)
  if (keyword) {
    const kw = keyword.toLowerCase()
    items = items.filter(
      (p) =>
        p.title.toLowerCase().includes(kw) ||
        p.content.toLowerCase().includes(kw) ||
        p.tags.some((t) => t.toLowerCase().includes(kw)),
    )
  }

  // Sort by newest first
  return items.sort((a, b) => b.createdAt - a.createdAt)
})
