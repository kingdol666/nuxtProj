// server/plugins/config.ts
//
// 配置引导 + 热重载驱动：
//   - server:create 时调用 loadConfig() 把 config.yml 读入进程内存
//   - 启动文件监听器 startConfigWatcher()
//   - 订阅变更 onConfigChange → 广播到所有在线 WS 连接（客户端即时刷新 UI/心跳）
//
// 这使得配置成为运行时的单一事实源：保存 config.yml 即刻全局生效。
import {
  loadConfig,
  startConfigWatcher,
  onConfigChange,
  publicConfig,
  type ConfigChange,
} from '~~/server/utils/appConfig'
import { broadcastToAll } from '~~/server/utils/realtime'

export default defineNitroPlugin(() => {
  // 1. 启动加载（持久化到进程内存）
  loadConfig()
  // 2. 启动文件监听 → 热重载
  startConfigWatcher()

  // 3. 订阅变更：广播「热」配置到所有在线客户端。
  //    启动键（端口/主机/密钥/数据目录）变更无法热切换，仅记录日志提示需重启。
  onConfigChange((evt: ConfigChange) => {
    if (evt.startupKeysChanged.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[config] 启动键已变更（需重启生效）: ${evt.startupKeysChanged.join(', ')}`,
      )
    }
    broadcastToAll({ type: 'config', config: publicConfig() })
  })
})
