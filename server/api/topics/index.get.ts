// GET /api/topics
// 热门话题列表：扫描所有帖子的 tags，统计每个 tag 的帖子数 + 最新帖子时间，按热度排序。
import { getPosts } from '~~/server/utils/db'

export default defineEventHandler(async () => {
  const posts = await getPosts()
  const stats = new Map<string, { name: string; postCount: number; lastPostAt: number }>()

  for (const p of posts) {
    for (const tag of p.tags) {
      const existing = stats.get(tag)
      if (existing) {
        existing.postCount += 1
        if (p.createdAt > existing.lastPostAt) existing.lastPostAt = p.createdAt
      } else {
        stats.set(tag, { name: tag, postCount: 1, lastPostAt: p.createdAt })
      }
    }
  }

  return [...stats.values()]
    .sort((a, b) => b.postCount - a.postCount || b.lastPostAt - a.lastPostAt)
    .slice(0, 30) // top 30 topics
})
