// start.mjs — 生产启动引导
//
// 在加载打包后的 Nitro 服务（.output/server/index.mjs）之前，先从 config.yml
// 读取 server.prodPort 与 server.host，通过 NITRO_PORT / NITRO_HOST 环境变量
// 注入。Nitro 运行时以此环境变量决定监听地址（优先级高于构建期值）。
//
// 因此修改生产端口/主机只需：编辑 config.yml → 重启（npm run start），
// 无需重新 build。
//
// 鲁棒：config.yml 缺失或格式错误时回退到内置默认（host 0.0.0.0 / port 3000）。
import { readFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const cfgPath = process.env.NUXT_CONFIG_FILE || join(process.cwd(), 'config.yml')

let host = '0.0.0.0'
let port = 3000
try {
  const raw = readFileSync(cfgPath, 'utf8')
  if (raw.trim()) {
    const { parse } = await import('yaml')
    const parsed = parse(raw)
    const server = parsed?.server
    if (server) {
      if (typeof server.host === 'string' && server.host) host = server.host
      if (typeof server.prodPort === 'number') port = server.prodPort
      else if (typeof server.prodPort === 'string' && /^\d+$/.test(server.prodPort)) {
        port = Number(server.prodPort)
      }
    }
  }
} catch {
  // 缺失 / 语法错误：保持默认
}

process.env.NITRO_PORT = String(port)
process.env.NITRO_HOST = host

// @napi-rs/canvas 的 ICU 数据文件（Skia 文本渲染所需）在 build 时不会被打入 .output，
// 这里在启动前从源 node_modules 复制到 .output 对应位置，否则 Skia 崩溃。
const icuSrc = join(process.cwd(), 'node_modules', '@napi-rs', 'canvas-win32-x64-msvc', 'icudtl.dat')
const icuDst = join(process.cwd(), '.output', 'server', 'node_modules', '@napi-rs', 'canvas-win32-x64-msvc', 'icudtl.dat')
if (existsSync(icuSrc) && !existsSync(icuDst)) {
  try { mkdirSync(join(icuDst, '..'), { recursive: true }); copyFileSync(icuSrc, icuDst) } catch { /* 忽略 */ }
}

await import('./.output/server/index.mjs')
