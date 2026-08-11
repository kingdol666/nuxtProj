// PUT /api/config
//
// 仅管理员可调用：用请求体覆盖 config.yml → 校验 → 即时生效 → 原子写回磁盘
// （写回后文件监听器也会触发，被 saveConfig 内部去重）。
// 返回最新公开配置 + 是否有启动键变更（前端据此提示需重启）。
import { saveConfig, publicConfig } from '~~/server/utils/appConfig'
import { requireAdmin } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const updated = saveConfig(body)
  return {
    config: {
      limits: updated.limits,
      realtime: updated.realtime,
      features: updated.features,
      branding: updated.branding,
      data: { cookieMaxAgeDays: updated.data.cookieMaxAgeDays },
    },
  }
})
