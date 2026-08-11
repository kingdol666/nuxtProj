// GET /api/feed/following → posts from users I follow, newest first
import { getPosts, getFollows } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const [posts, follows] = await Promise.all([getPosts(), getFollows()])
  const followingIds = new Set(
    follows.filter((f) => f.followerId === user.id).map((f) => f.followeeId),
  )
  // Include my own posts in the feed too (common pattern)
  followingIds.add(user.id)

  return posts
    .filter((p) => followingIds.has(p.userId))
    .sort((a, b) => b.createdAt - a.createdAt)
})
