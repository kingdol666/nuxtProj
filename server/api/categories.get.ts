import { getCategories } from '~~/server/utils/db'

export default defineEventHandler(async () => {
  return await getCategories()
})
