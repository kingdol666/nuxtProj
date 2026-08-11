// GET /api/poster/cover?title=X&content=Y&tags=a,b&gradient=0
// 生成笔记封面预览图（供编辑器实时预览 + 配色切换）。
import { generateCoverImage, getGradient } from '~~/server/utils/poster'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const title = (q.title as string || '').trim()
  const content = (q.content as string || '').trim()
  const tags = (q.tags as string || '').split(',').map((t) => t.trim()).filter(Boolean)
  const gradient = q.gradient !== undefined ? parseInt(q.gradient as string, 10) : undefined

  if (!title) throw createError({ statusCode: 400, statusMessage: 'title is required' })

  const png = await generateCoverImage({
    title,
    content: content || title,
    tags,
    gradientIndex: Number.isNaN(gradient as number) ? undefined : gradient,
  })

  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=60')
  return png
})
