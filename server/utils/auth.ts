// server/utils/auth.ts
//
// 无状态认证：HMAC 签名 cookie token + scrypt 密码哈希。
// 无需 session 存储，完全无状态，适配 JSON 文件数据层。
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { getCookie, deleteCookie, setCookie } from 'h3'
import type { H3Event } from 'h3'
import { getConfig } from './appConfig'

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>

const COOKIE_NAME = 'auth_token'
const TOKEN_TTL_MS = () => getConfig().data.cookieMaxAgeDays * 24 * 60 * 60 * 1000

// HMAC secret: from runtimeConfig or a stable derived default.
// (dev only — production MUST set NUXT_AUTH_SECRET)
function getSecret(): string {
  try {
    const s = useRuntimeConfig().authSecret
    if (s && typeof s === 'string') return s
  } catch { /* runtime config not ready */ }
  return process.env.NUXT_AUTH_SECRET || 'nuxt-app-dev-secret-change-in-prod'
}

// ─── Password hashing (scrypt) ────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, 64)
  return `${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':')
  if (!salt || !key) return false
  const derived = await scrypt(password, salt, 64)
  const keyBuf = Buffer.from(key, 'hex')
  try {
    return derived.length === keyBuf.length && timingSafeEqual(derived, keyBuf)
  } catch {
    return false
  }
}

// ─── Token signing (HMAC-SHA256) ──────────────────────────────────────
function signToken(userId: string): string {
  const payload = JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL_MS() })
  const b64 = Buffer.from(payload).toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

export function verifyToken(token: string | undefined): { uid: string } | null {
  if (!token || !token.includes('.')) return null
  const [b64, sig] = token.split('.')
  const expected = createHmac('sha256', getSecret()).update(b64).digest('base64url')
  // Constant-time compare
  try {
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8'))
    if (!payload.uid || payload.exp < Date.now()) return null
    return { uid: payload.uid }
  } catch {
    return null
  }
}

// ─── Cookie helpers ───────────────────────────────────────────────────
export function setAuthCookie(event: H3Event, userId: string) {
  const ttl = TOKEN_TTL_MS()
  setCookie(event, COOKIE_NAME, signToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ttl / 1000,
  })
}

export function clearAuthCookie(event: H3Event) {
  // 显式用与 setAuthCookie 完全一致的属性(maxAge=0 过期)清除 cookie，
  // 保证浏览器按 name+path 精确匹配并删除。
  setCookie(event, COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

// ─── Current user resolution ──────────────────────────────────────────
// Reads cookie → verifies HMAC → fetches user from store.
// Strips passwordHash before returning (safe user object).
export async function getUserFromEvent(event: H3Event): Promise<Omit<User, 'passwordHash'> | null> {
  const token = getCookie(event, COOKIE_NAME)
  const decoded = verifyToken(token)
  if (!decoded) return null
  const users = await getUsers()
  const user = users.find((u) => u.id === decoded.uid)
  if (!user) return null
  const { passwordHash: _ph, ...safe } = user
  // Backfill new optional fields for legacy users
  return { ...safe, avatarUrl: safe.avatarUrl || '', backgroundUrl: safe.backgroundUrl || '' }
}

// Require auth — throws 401 if not authenticated.
export async function requireUser(event: H3Event): Promise<Omit<User, 'passwordHash'>> {
  const user = await getUserFromEvent(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: '请先登录' })
  return user
}

// Require admin role — throws 401 if not authed, 403 if not admin.
export async function requireAdmin(event: H3Event): Promise<Omit<User, 'passwordHash'>> {
  const user = await requireUser(event)
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: '需要管理员权限' })
  }
  return user
}
