// PUT /api/users/profile → update current user's bio, avatarUrl, backgroundUrl
// Body: { bio?, avatarUrl?, backgroundUrl? }
// Only the authenticated user can update their own profile.
import { updateUsers } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{
    bio?: string
    avatarUrl?: string
    backgroundUrl?: string
  }>(event)

  const updates: { bio?: string; avatarUrl?: string; backgroundUrl?: string } = {}

  if (typeof body.bio === 'string') {
    const bio = body.bio.trim()
    if (bio.length > 200) throw createError({ statusCode: 400, statusMessage: '简介最多 200 字' })
    updates.bio = bio
  }
  if (typeof body.avatarUrl === 'string') {
    // Must be a relative upload path or empty (clear)
    if (body.avatarUrl && !body.avatarUrl.startsWith('/api/uploads/')) {
      throw createError({ statusCode: 400, statusMessage: '头像地址无效' })
    }
    updates.avatarUrl = body.avatarUrl
  }
  if (typeof body.backgroundUrl === 'string') {
    if (body.backgroundUrl && !body.backgroundUrl.startsWith('/api/uploads/')) {
      throw createError({ statusCode: 400, statusMessage: '背景地址无效' })
    }
    updates.backgroundUrl = body.backgroundUrl
  }

  return await updateUsers((items) => {
    const u = items.find((x) => x.id === user.id)
    if (!u) throw createError({ statusCode: 404, statusMessage: '用户不存在' })
    Object.assign(u, updates)
    return {
      id: u.id,
      username: u.username,
      role: u.role,
      avatarColor: u.avatarColor,
      avatarUrl: u.avatarUrl || '',
      backgroundUrl: u.backgroundUrl || '',
      bio: u.bio,
      createdAt: u.createdAt,
    }
  })
})
