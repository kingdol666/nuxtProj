import { getContent } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const items = await getContent()
  const query = getQuery(event)
  // Optional filter by category
  const category = query.category as string | undefined
  if (category) {
    return items.filter((i) => i.category === category)
  }
  return items
})
