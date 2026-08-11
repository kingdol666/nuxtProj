import { getPosts } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })

  const items = await getPosts()
  const post = items.find((p) => p.id === id)
  if (!post) throw createError({ statusCode: 404, statusMessage: '帖子不存在' })
  return post
})
