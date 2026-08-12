// GET /api/poster/post?id=xxx
// 生成帖子分享卡片 PNG（封面图 + 标题 + 摘要 + 作者 + 品牌）。
import { generatePostPoster } from '~~/server/utils/poster'
import { getPosts, getImages, uploadsDir } from '~~/server/utils/db'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'


export default defineEventHandler(async (event) => {
  const id = (getQuery(event).id as string || '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })

  const posts = await getPosts()
  const post = posts.find((p) => p.id === id)
  if (!post) throw createError({ statusCode: 404, statusMessage: '帖子不存在' })

  // Load cover image (first image of the post) if available
  let coverBuffer: Buffer | null = null
  const coverUrl = post.images?.[0]
  if (coverUrl) {
    // Extract filename from URL like /api/uploads/xxx.png
    const filename = coverUrl.split('/').pop()
    if (filename) {
      try {
        coverBuffer = await readFile(join(uploadsDir(), filename))
      } catch {
        // Try imageMeta lookup as fallback
        try {
          const images = await getImages()
          const meta = images.find((m) => m.url === coverUrl)
          if (meta) coverBuffer = await readFile(join(uploadsDir(), meta.filename))
        } catch { /* no cover */ }
      }
    }
  }

  const png = await generatePostPoster({
    title: post.title,
    content: post.content,
    coverBuffer,
    username: post.username,
    avatarColor: post.avatarColor,
    tags: post.tags,
  })

  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=300')
  return png
})
