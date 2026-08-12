import { getUsers } from '~~/server/utils/db'
import { verifyPassword, hashPassword, setAuthCookie } from '~~/server/utils/auth'

// Constant-time-ish: always run one scrypt verification so a missing username
// cannot be distinguished from a wrong password by response timing.
const DUMMY_HASH_P = hashPassword('timing-equalizer')

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: string; password?: string }>(event)
  const username = body?.username?.trim()
  const password = body?.password

  if (!username || !password) {
    throw createError({ statusCode: 400, statusMessage: '用户名和密码不能为空' })
  }

  const users = await getUsers()
  const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase())
  if (!user) {
    // Username not found — still pay the scrypt cost to equalize timing.
    await verifyPassword(password, await DUMMY_HASH_P)
    throw createError({ statusCode: 401, statusMessage: '用户名或密码错误' })
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw createError({ statusCode: 401, statusMessage: '用户名或密码错误' })
  }

  setAuthCookie(event, user.id)
  const { passwordHash: _ph, ...safe } = user
  return safe
})
