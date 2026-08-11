// server/utils/poster.ts
//
// 服务端海报生成引擎：基于 @napi-rs/canvas 渲染小红书风格的话题海报 / 帖子分享卡。
//
// 设计理念：
//   - 话题海报：大尺寸渐变背景 + 话题名超大字号 + 参与数据 + 装饰元素
//   - 帖子卡片：封面图 + 标题 + 摘要 + 作者信息 + 品牌水印
//   - 全部使用项目设计系统配色（Indigo-Violet 主色系）
//   - 中文文本自动换行处理
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas'
import { existsSync } from 'node:fs'

// ─── 字体注册（Windows 系统字体；其他平台优雅降级）──────────────────────
let fontsRegistered = false
function registerFonts() {
  const candidates = [
    { path: 'C:/Windows/Fonts/msyh.ttc', family: 'Noto Sans SC' },
    { path: 'C:/Windows/Fonts/msyhbd.ttc', family: 'Noto Sans SC Bold' },
    { path: 'C:/Windows/Fonts/simhei.ttf', family: 'SimHei' },
  ]
  for (const f of candidates) {
    if (existsSync(f.path)) {
      try { GlobalFonts.registerFromPath(f.path, f.family) } catch { /* skip */ }
    }
  }
  fontsRegistered = true
}

// ─── 中文文本换行 ────────────────────────────────────────────────────────
function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const char of text) {
    const test = current + char
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = char
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

// ─── 颜色工具 ────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/.{2}/g)
  return m ? [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)] : [99, 102, 241]
}
function mixHex(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1)
  const [r2, g2, b2] = hexToRgb(c2)
  // 按比例 t 在 c1 和 c2 之间线性插值（lerp）
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t)
  return `rgb(${mix(r1, r2)},${mix(g1, g2)},${mix(b1, b2)})`
}

// ─── 渐变配色板（每个话题根据名字哈希选择不同色系）─────────────────────────
export const GRADIENTS = [
  ['#667eea', '#764ba2'], // 紫罗兰
  ['#f093fb', '#f5576c'], // 粉色
  ['#4facfe', '#00f2fe'], // 青色
  ['#43e97b', '#38f9d7'], // 绿色
  ['#fa709a', '#fee140'], // 橙粉
  ['#30cfd0', '#330867'], // 深蓝
  ['#a8edea', '#fed6e3'], // 薄荷粉
  ['#ff9a9e', '#fecfef'], // 浅粉
  ['#ffecd2', '#fcb69f'], // 暖橙
  ['#a1c4fd', '#c2e9fb'], // 天蓝
]
export const GRADIENT_NAMES = ['紫罗兰', '粉色', '青色', '绿色', '橙粉', '深蓝', '薄荷粉', '浅粉', '暖橙', '天蓝']
function hashGradient(name: string): [string, string] {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return GRADIENTS[h % GRADIENTS.length] as [string, string]
}
// 按索引取渐变（供用户在配色选择器中指定）
export function getGradient(index: number): [string, string] {
  const i = ((index % GRADIENTS.length) + GRADIENTS.length) % GRADIENTS.length
  return GRADIENTS[i] as [string, string]
}

// ─── 圆角矩形路径 ─────────────────────────────────────────────────────────
function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

// ═══ 话题海报生成 ═══════════════════════════════════════════════════════
// 尺寸 750 × 1000（竖版海报，适配手机屏幕）
export async function generateTopicPoster(opts: {
  name: string
  description?: string
  postCount: number
  participantCount?: number
}): Promise<Buffer> {
  registerFonts()
  const W = 750, H = 1000
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const [c1, c2] = hashGradient(opts.name)

  // ── 主背景渐变 ──
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, c1)
  grad.addColorStop(1, c2)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // ── 装饰圆（半透明光斑）──
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.arc(120, 180, 200, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(W - 80, H - 120, 260, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(W - 200, 200, 120, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1

  // ── # 标记 ──
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = `${'700'} 120px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('#', W / 2, 360)

  // ── 话题名（超大字号，自动换行）──
  ctx.fillStyle = '#ffffff'
  ctx.font = `${'700'} 72px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  ctx.textAlign = 'center'
  const nameLines = wrapText(ctx, opts.name, W - 120)
  let nameY = 440
  for (const line of nameLines.slice(0, 3)) {
    ctx.fillText(line, W / 2, nameY)
    nameY += 84
  }

  // ── 话题描述 ──
  if (opts.description) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = `${'400'} 28px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
    const descLines = wrapText(ctx, opts.description, W - 160)
    let descY = nameY + 30
    for (const line of descLines.slice(0, 4)) {
      ctx.fillText(line, W / 2, descY)
      descY += 40
    }
  }

  // ── 底部数据条 ──
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  roundRect(ctx, 80, H - 240, W - 160, 120, 20)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = `${'700'} 44px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  ctx.fillText(String(opts.postCount), W / 2 - 120, H - 175)
  ctx.font = `${'400'} 24px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText('篇笔记', W / 2 - 120, H - 145)

  ctx.fillStyle = '#ffffff'
  ctx.font = `${'700'} 44px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  ctx.fillText(String(opts.participantCount ?? opts.postCount), W / 2 + 120, H - 175)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = `${'400'} 24px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  ctx.fillText('位参与', W / 2 + 120, H - 145)

  // ── 品牌水印 ──
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = `${'600'} 22px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('Nuxt Community · 发现好内容', W / 2, H - 50)

  return canvas.toBuffer('image/png')
}

// ═══ 帖子分享卡片 ═══════════════════════════════════════════════════════
// 尺寸 750 × 1000（竖版分享卡）
export async function generatePostPoster(opts: {
  title: string
  content: string
  coverUrl?: string | null
  username: string
  avatarColor: number
  tags?: string[]
  coverBuffer?: Buffer | null  // pre-loaded image buffer
}): Promise<Buffer> {
  registerFonts()
  const W = 750, H = 1000
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  // ── 白色卡片背景 ──
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  const [gc1, gc2] = hashGradient(opts.title)
  let yCursor = 0

  // ── 封面图区域（渐变底色 + 可选图片）──
  const coverH = 480
  const coverGrad = ctx.createLinearGradient(0, 0, W, coverH)
  coverGrad.addColorStop(0, gc1)
  coverGrad.addColorStop(1, gc2)
  ctx.fillStyle = coverGrad
  ctx.fillRect(0, 0, W, coverH)

  if (opts.coverBuffer) {
    try {
      const img = await loadImage(opts.coverBuffer)
      // cover-fit
      const scale = Math.max(W / img.width, coverH / img.height)
      const dw = img.width * scale, dh = img.height * scale
      ctx.drawImage(img, (W - dw) / 2, (coverH - dh) / 2, dw, dh)
    } catch { /* 渐变底色兜底 */ }
  } else {
    // 装饰图标
    ctx.globalAlpha = 0.2
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.arc(W / 2, coverH / 2, 80, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = `${'400'} 60px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('📷', W / 2, coverH / 2 + 20)
  }

  yCursor = coverH + 50

  // ── 标签 ──
  if (opts.tags?.length) {
    ctx.textAlign = 'left'
    ctx.font = `${'600'} 24px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
    let tagX = 50
    for (const tag of opts.tags.slice(0, 4)) {
      const label = `#${tag}`
      const tw = ctx.measureText(label).width
      ctx.fillStyle = mixHex(gc1, '#ffffff', 0.88)
      roundRect(ctx, tagX, yCursor, tw + 28, 40, 20)
      ctx.fill()
      ctx.fillStyle = gc1
      ctx.fillText(label, tagX + 14, yCursor + 28)
      tagX += tw + 40
    }
    yCursor += 60
  }

  // ── 标题 ──
  ctx.fillStyle = '#1e1e2e'
  ctx.font = `${'700'} 40px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  ctx.textAlign = 'left'
  const titleLines = wrapText(ctx, opts.title, W - 100)
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, 50, yCursor)
    yCursor += 48
  }
  yCursor += 12

  // ── 内容摘要 ──
  ctx.fillStyle = '#6b7280'
  ctx.font = `${'400'} 28px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  const contentLines = wrapText(ctx, opts.content.slice(0, 200), W - 100)
  for (const line of contentLines.slice(0, 4)) {
    ctx.fillText(line, 50, yCursor)
    yCursor += 38
  }

  // ── 底部作者栏 ──
  ctx.fillStyle = '#f3f4f6'
  ctx.fillRect(0, H - 130, W, 130)

  // 头像圆
  const avatarColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']
  ctx.fillStyle = avatarColors[opts.avatarColor % avatarColors.length]
  ctx.beginPath(); ctx.arc(70, H - 65, 30, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = `${'700'} 28px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(opts.username.charAt(0).toUpperCase(), 70, H - 55)

  ctx.fillStyle = '#1e1e2e'
  ctx.font = `${'600'} 28px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(opts.username, 120, H - 58)
  ctx.fillStyle = '#9ca3af'
  ctx.font = `${'400'} 22px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  ctx.fillText('发布了一篇笔记', 120, H - 28)

  // 品牌水印
  ctx.fillStyle = '#9ca3af'
  ctx.font = `${'600'} 20px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  ctx.textAlign = 'right'
  ctx.fillText('Nuxt Community', W - 30, H - 28)

  return canvas.toBuffer('image/png')
}

// ═══ 笔记封面图生成（无上传图片时自动生成）═══════════════════════════════
// 尺寸 750 × 1000（与小红书笔记封面比例一致），渐变背景 + 标题/标签
export async function generateCoverImage(opts: {
  title: string
  content: string
  tags?: string[]
  gradientIndex?: number  // 用户选择的配色索引（-1 = 按标题哈希）
}): Promise<Buffer> {
  registerFonts()
  const W = 750, H = 1000
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const [c1, c2] = opts.gradientIndex !== undefined && opts.gradientIndex >= 0
    ? getGradient(opts.gradientIndex)
    : hashGradient(opts.title)

  // ── 全屏渐变背景 ──
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, c1)
  grad.addColorStop(1, c2)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // ── 装饰光斑 ──
  ctx.globalAlpha = 0.1
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.arc(W - 100, 120, 180, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(80, H - 100, 220, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1

  // ── 标签胶囊（顶部）──
  if (opts.tags?.length) {
    ctx.textAlign = 'left'
    ctx.font = `${'600'} 26px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
    let tagX = 60, tagY = 80
    for (const tag of opts.tags.slice(0, 3)) {
      const label = `#${tag}`
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      roundRect(ctx, tagX, tagY, tw + 30, 44, 22)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, tagX + 15, tagY + 30)
      tagX += tw + 44
    }
  }

  // ── 标题（居中大字，自动换行）──
  ctx.fillStyle = '#ffffff'
  ctx.font = `${'700'} 56px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  ctx.textAlign = 'center'
  const titleLines = wrapText(ctx, opts.title, W - 120)
  const titleStartY = (H - titleLines.length * 68) / 2 + 56
  let ty = titleStartY
  for (const line of titleLines.slice(0, 4)) {
    ctx.fillText(line, W / 2, ty)
    ty += 68
  }

  // ── 内容摘要（标题下方，半透明）──
  if (opts.content) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = `${'400'} 28px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
    const excerpt = opts.content.replace(/\n/g, ' ').slice(0, 60)
    const contentLines = wrapText(ctx, excerpt + (opts.content.length > 60 ? '…' : ''), W - 140)
    let cy = ty + 40
    for (const line of contentLines.slice(0, 3)) {
      ctx.fillText(line, W / 2, cy)
      cy += 38
    }
  }

  // ── 底部品牌 ──
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = `${'600'} 22px "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('Nuxt Community', W / 2, H - 50)

  return canvas.toBuffer('image/png')
}
