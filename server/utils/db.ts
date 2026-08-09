import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'

type DataKind = 'categories' | 'content' | 'tags' | 'users' | 'comments' | 'ratings'

// Each resource kind maps to a backing file. (`categories` lives in
// menu.json for historical reasons — the admin "分组" UI == the nav menu.)
const FILENAME: Record<DataKind, string> = {
  categories: 'menu.json',
  content: 'content.json',
  tags: 'tags.json',
  users: 'users.json',
  comments: 'comments.json',
  ratings: 'ratings.json',
}

// ─── Data directory resolution ───────────────────────────────────────
// Order: runtimeConfig.dataDir → NUXT_DATA_DIR env → <cwd>/data.
// For read-only / serverless deploys, point this at a writable persistent
// volume. Writes to a read-only location degrade to a clear 507 instead of
// crashing the process.
function resolveDataDir(): string {
  let configured = ''
  try {
    const dir = useRuntimeConfig().dataDir
    if (typeof dir === 'string') configured = dir
  } catch {
    configured = ''
  }
  return configured || process.env.NUXT_DATA_DIR || join(process.cwd(), 'data')
}

function fileFor(kind: DataKind): string {
  return join(resolveDataDir(), FILENAME[kind])
}

// ─── Low-level JSON I/O (atomic + fault-tolerant) ────────────────────
async function readJson<T>(file: string): Promise<T> {
  let raw: string
  try {
    raw = await fs.readFile(file, 'utf-8')
  } catch (e) {
    // Missing file → treat as empty (e.g. fresh deploy without bundled data).
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return [] as unknown as T
    throw e
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    // Corrupt JSON: quarantine the bad file so the server keeps serving,
    // and surface an empty collection instead of crashing every request.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await fs.writeFile(`${file}.corrupt-${stamp}`, raw, 'utf-8').catch(() => {})
    return [] as unknown as T
  }
}

// Write atomically: temp file in the same directory (same filesystem →
// rename is atomic). Translates permission / read-only errors into a
// clean HTTP error rather than an uncaught exception.
async function writeJson<T>(file: string, data: T): Promise<void> {
  const json = JSON.stringify(data, null, 2)
  const tmp = `${file}.${process.pid}.tmp`
  try {
    await fs.mkdir(dirname(file), { recursive: true })
    await fs.writeFile(tmp, json, 'utf-8')
    await fs.rename(tmp, file)
  } catch (e) {
    await fs.unlink(tmp).catch(() => {})
    const code = (e as NodeJS.ErrnoException)?.code
    const readonly =
      code === 'EROFS' || code === 'EACCES' || code === 'EPERM' || code === 'ENOSPC'
    throw createError({
      statusCode: readonly ? 507 : 500,
      statusMessage: readonly
        ? '数据目录为只读，无法写入。请设置环境变量 NUXT_DATA_DIR 指向一个可写的持久化目录。'
        : `写入数据失败：${(e as Error)?.message || String(e)}`,
    })
  }
}

// ─── In-process write mutex ──────────────────────────────────────────
// Serializes read-modify-write per resource so concurrent requests within
// a single process can't lose updates. (Multi-process deploys need a shared
// FS lock — out of scope here.)
const locks = new Map<string, Promise<unknown>>()
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve()
  const run = prev.then(fn, fn)
  // Keep the chain alive without leaking earlier failures to later callers.
  locks.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  )
  return run
}

// Generate a short unique id.
export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// Transactional update: lock → read → mutate(in place) → write.
// `fn` mutates the array in place and returns whatever the caller wants
// surfaced (the created/updated entity, a result object). Throwing inside
// `fn` aborts the transaction before any write happens.
async function updateData<T, R>(kind: DataKind, fn: (items: T[]) => R | Promise<R>): Promise<R> {
  return withLock(kind, async () => {
    const items = await readJson<T[]>(fileFor(kind))
    const result = await fn(items)
    await writeJson(fileFor(kind), items)
    return result
  })
}

// Backfill stable ids for legacy entries once (best-effort; ignore write
// failures so reads on a read-only FS still work).
async function ensureIds<T extends { id?: string }>(items: T[], kind: DataKind): Promise<void> {
  if (items.length && items.some((i) => !i.id)) {
    items.forEach((i) => {
      if (!i.id) i.id = genId()
    })
    await writeJson(fileFor(kind), items).catch(() => {})
  }
}

// ─── Categories (分组) ───────────────────────────────────────────────
export interface Category {
  id?: string
  title: string
  title_zh: string
  icon: string
}

export async function getCategories(): Promise<Category[]> {
  const data = await readJson<Category[]>(fileFor('categories'))
  await ensureIds(data, 'categories')
  return data
}

export function updateCategories<R>(fn: (items: Category[]) => R | Promise<R>): Promise<R> {
  return updateData<Category, R>('categories', fn)
}

// ─── Content (内容) ──────────────────────────────────────────────────
export interface ContentItem {
  id?: string
  category: string
  category_zh: string
  subCategory: string
  subCategory_zh: string
  name: string
  name_zh: string
  content: string
  content_zh: string
  detail: string
  detail_zh: string
  url: string
  rating: number
}

export async function getContent(): Promise<ContentItem[]> {
  const data = await readJson<ContentItem[]>(fileFor('content'))
  await ensureIds(data, 'content')
  return data
}

export function updateContent<R>(fn: (items: ContentItem[]) => R | Promise<R>): Promise<R> {
  return updateData<ContentItem, R>('content', fn)
}

// ─── Tags (子分类/标签) ──────────────────────────────────────────────
// Independent tag definitions. `name` aligns with content.subCategory so
// the admin can pre-define tags that content items can later reference.
export interface Tag {
  id?: string
  name: string
  name_zh: string
  category?: string
  category_zh?: string
}

export async function getTags(): Promise<Tag[]> {
  const data = await readJson<Tag[]>(fileFor('tags'))
  await ensureIds(data, 'tags')
  return data
}

export function updateTags<R>(fn: (items: Tag[]) => R | Promise<R>): Promise<R> {
  return updateData<Tag, R>('tags', fn)
}

// ─── Users (用户系统) ────────────────────────────────────────────────
export interface User {
  id: string
  username: string
  passwordHash: string
  role: 'admin' | 'user'  // 角色：admin 可管理后台，user 为普通用户
  avatarColor: number  // 0-5, indexes into a palette
  bio: string
  createdAt: number
}

export async function getUsers(): Promise<User[]> {
  return readJson<User[]>(fileFor('users'))
}

export function updateUsers<R>(fn: (items: User[]) => R | Promise<R>): Promise<R> {
  return updateData<User, R>('users', fn)
}

// ─── Comments (评论) ─────────────────────────────────────────────────
export interface Comment {
  id: string
  contentId: string       // which app/content this belongs to
  userId: string
  username: string
  avatarColor: number
  text: string
  parentId: string | null // null = top-level; otherwise = parent comment id
  likedBy: string[]       // userIds who liked
  createdAt: number
}

export async function getComments(): Promise<Comment[]> {
  return readJson<Comment[]>(fileFor('comments'))
}

export function updateComments<R>(fn: (items: Comment[]) => R | Promise<R>): Promise<R> {
  return updateData<Comment, R>('comments', fn)
}

// ─── Ratings (评分) ──────────────────────────────────────────────────
export interface Rating {
  id: string
  contentId: string
  userId: string
  value: number  // 1-5
  createdAt: number
}

export async function getRatings(): Promise<Rating[]> {
  return readJson<Rating[]>(fileFor('ratings'))
}

export function updateRatings<R>(fn: (items: Rating[]) => R | Promise<R>): Promise<R> {
  return updateData<Rating, R>('ratings', fn)
}
