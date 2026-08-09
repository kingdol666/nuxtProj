import { getUserFromEvent } from '~~/server/utils/auth'

export default defineEventHandler((event) => {
  return getUserFromEvent(event)
})
