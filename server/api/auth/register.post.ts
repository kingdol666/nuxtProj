import { updateUsers, genId } from '~~/server/utils/db'
import { hashPassword, setAuthCookie } from '~~/server/utils/auth'

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

  return await updateUsers(async (users) => {
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      throw createError({ statusCode: 409, statusMessage: '该用户名已被注册' })
    }
    const user = {
      id: genId(),
      username,
      passwordHash: await hashPassword(password),
      avatarColor: users.length % AVATAR_PALETTE_COUNT,
      bio: '',
      createdAt: Date.now(),
    }
    users.push(user)
    setAuthCookie(event, user.id)
    const { passwordHash: _ph, ...safe } = user
    return safe
  })
})
