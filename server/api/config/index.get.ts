// GET /api/config
//
// 返回下发给客户端的安全配置子集（剔除密钥/端口/数据目录等内部项）。
// 供 useAppConfig composable 在首屏 SSR 时预取。
import { publicConfig } from '~~/server/utils/appConfig'

export default defineEventHandler(() => publicConfig())
