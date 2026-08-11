// GET /api/poster/topic?name=旅行
// 生成话题海报 PNG（小红书风格渐变大图）。
import { generateTopicPoster } from '~~/server/utils/poster'
import { getPosts } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const name = (getQuery(event).name as string || '').trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'name is required' })

  const posts = await getPosts()
  const postCount = posts.filter((p) => p.tags.includes(name)).length
  // 参与人数 = 去重 userId
  const participants = new Set(
    posts.filter((p) => p.tags.includes(name)).map((p) => p.userId),
  )

  const png = await generateTopicPoster({
    name: `#${name}`,
    description: postCount > 0 ? `${postCount} 篇笔记 · ${participants.size} 人参与` : '快来发布第一篇笔记吧',
    postCount,
    participantCount: participants.size,
  })

  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=300')
  return png
})
