// POST /api/follows  { targetUserId } → toggle follow
// Returns { following: bool }. On a new follow, notifies the target in real-time.
import { updateFollows, getFollows, getUsers, genId } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { sendToUser } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ targetUserId?: string }>(event)
  const targetUserId = body?.targetUserId?.trim()
  if (!targetUserId) throw createError({ statusCode: 400, statusMessage: 'targetUserId is required' })
  if (targetUserId === user.id) throw createError({ statusCode: 400, statusMessage: '不能关注自己' })

  const result = await updateFollows((items) => {
    const idx = items.findIndex((f) => f.followerId === user.id && f.followeeId === targetUserId)
    let following: boolean
    if (idx === -1) {
      items.push({ id: genId(), followerId: user.id, followeeId: targetUserId, createdAt: Date.now() })
      following = true
    } else {
      items.splice(idx, 1)
      following = false
    }
    return { following }
  })

  if (result.following) {
    // Notify the target of the new follower (real-time; fire-and-forget)
    sendToUser(targetUserId, {
      type: 'follow',
      fromUserId: user.id,
      fromUsername: user.username,
      fromAvatarColor: user.avatarColor,
      createdAt: Date.now(),
    })
  }

  return result
})
