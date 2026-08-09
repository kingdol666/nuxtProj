import { getTags } from '~~/server/utils/db'

export default defineEventHandler(async () => {
  return await getTags()
})
