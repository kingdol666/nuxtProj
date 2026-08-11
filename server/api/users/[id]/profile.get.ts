// GET /api/users/[id]/profile → public profile + aggregate stats
import { getUsers, getPosts, getFollows } from '~~/server/utils/db'
import { getUserFromEvent } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })

  const users = await getUsers()
  const u = users.find((x) => x.id === id)
  if (!u) throw createError({ statusCode: 404, statusMessage: '用户不存在' })

  const [posts, follows] = await Promise.all([getPosts(), getFollows()])

  const myPosts = posts.filter((p) => p.userId === id)
  const followingCount = follows.filter((f) => f.followerId === id).length
  const followersCount = follows.filter((f) => f.followeeId === id).length
  const totalLikes = myPosts.reduce((sum, p) => sum + p.likedBy.length, 0)
  const totalCollected = myPosts.reduce((sum, p) => sum + p.collectedBy.length, 0)

  // Is the current viewer following this user?
  const viewer = await getUserFromEvent(event)
  const isFollowing = viewer
    ? follows.some((f) => f.followerId === viewer.id && f.followeeId === id)
    : false

  return {
    id: u.id,
    username: u.username,
    avatarColor: u.avatarColor,
    avatarUrl: u.avatarUrl || '',
    backgroundUrl: u.backgroundUrl || '',
    bio: u.bio,
    role: u.role,
    createdAt: u.createdAt,
    isSelf: viewer?.id === id,
    stats: {
      postCount: myPosts.length,
      followingCount,
      followersCount,
      totalLikes,
      totalCollected,
    },
    isFollowing,
  }
})
