import { updateUsers, genId } from '~~/server/utils/db'
import { hashPassword, setAuthCookie } from '~~/server/utils/auth'
import { getConfig } from '~~/server/utils/appConfig'

const AVATAR_PALETTE_COUNT = 6

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: string; password?: string }>(event)
  const username = body?.username?.trim()
  const password = body?.password

  if (!username || username.length < 2) {
    throw createError({ statusCode: 400, statusMessage: '用户名至少 2 个字符' })
  }
  if (!password || password.length < 6) {
    throw createError({ statusCode: 400, statusMessage: '密码至少 6 个字符' })
  }
  if (!getConfig().features.enableSignup) {
    throw createError({ statusCode: 403, statusMessage: '管理员已关闭注册' })
  }

  return await updateUsers(async (users) => {
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      throw createError({ statusCode: 409, statusMessage: '该用户名已被注册' })
    }
    const user = {
      id: genId(),
      username,
      passwordHash: await hashPassword(password),
      role: 'user' as const,  // 注册用户默认为普通用户
      avatarColor: users.length % AVATAR_PALETTE_COUNT,
      avatarUrl: '',
      backgroundUrl: '',
      bio: '',
      createdAt: Date.now(),
    }
    users.push(user)
    setAuthCookie(event, user.id)
    const { passwordHash: _ph, ...safe } = user
    return safe
  })
})
