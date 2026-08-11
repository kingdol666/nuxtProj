// GET /api/follows
// Query: ?userId=X&dir=followers|following   → list of that user's followers/following
// Query: ?userId=X&check=Y                   → { following: bool } (does X follow Y)
import { getFollows, getUsers } from '~~/server/utils/db'
import { getUserFromEvent } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const userId = query.userId as string | undefined
  const dir = (query.dir as string) || 'following'
  const checkTarget = query.check as string | undefined

  const all = await getFollows()

  // Simple check: does userId follow checkTarget?
  if (checkTarget && userId) {
    return { following: all.some((f) => f.followerId === userId && f.followeeId === checkTarget) }
  }

  if (!userId) throw createError({ statusCode: 400, statusMessage: 'userId is required' })

  let rels
  if (dir === 'followers') {
    // people who follow userId
    rels = all.filter((f) => f.followeeId === userId)
  } else {
    // people userId follows
    rels = all.filter((f) => f.followerId === userId)
  }

  // Resolve user public profiles
  const users = await getUsers()
  const wantedIds = new Set(rels.map((r) => (dir === 'followers' ? r.followerId : r.followeeId)))
  const profiles = users
    .filter((u) => wantedIds.has(u.id))
    .map((u) => ({ id: u.id, username: u.username, avatarColor: u.avatarColor, bio: u.bio }))

  return {
    dir,
    count: profiles.length,
    users: profiles,
  }
})
