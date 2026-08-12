// server/utils/wukongim.ts
//
// WuKongIM HTTP API 客户端：服务端调用 WuKongIM 的 HTTP API（5001）。
// - 群组频道用 channel_type=2，频道 id 约定为 `grp_<groupId>`。
// - 与 WuKongIM 不可达时降级为「软失败」：业务落库（groups.json）正常，
//   仅实时推送不可用 —— 客户端重连 WuKongIM 后仍能收发（WuKongIM 自带离线消息）。
//   故本模块的所有调用均吞掉网络错误并返回 false，绝不抛出打断业务流程。
import { getConfig } from './appConfig'

export const GRP_PREFIX = 'grp_'
/** 群组在 WuKongIM 中对应的频道 ID */
export function groupChannelId(groupId: string): string {
  return GRP_PREFIX + groupId
}

// ─── 低层请求：调 WuKongIM HTTP API；网络错误静默降级 ───────────────────
async function wkFetch(path: string, opts: { method?: string; body?: unknown } = {}): Promise<boolean> {
  const cfg = getConfig().wukongim
  if (!cfg.enabled) return false
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cfg.managerToken) headers.token = cfg.managerToken
  try {
    const res = await fetch(cfg.apiURL + path, {
      method: opts.method || 'POST',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    return res.ok || res.status === 200
  } catch {
    // WuKongIM 不可达 —— 软失败（见模块注释）
    return false
  }
}

// ─── 频道 / 订阅者管理 ─────────────────────────────────────────────────
/**
 * 创建群组频道并设置初始订阅者。
 * WuKongIM 的 POST /channel：channel_id + channel_type(2=群组) + subscribers[]。
 */
export async function createGroupChannel(groupId: string, memberIds: string[]): Promise<boolean> {
  return wkFetch('/channel', {
    body: {
      channel_id: groupChannelId(groupId),
      channel_type: 2,
      large: 0,
      ban: 0,
      subscribers: memberIds,
    },
  })
}

/**
 * 同步群组订阅者（WuKongIM 会用此列表覆盖频道成员）。
 * 成员变更（接受邀请 / 退群 / 踢人）后调用，保证 WuKongIM 频道成员与应用一致。
 */
export async function syncGroupSubscribers(groupId: string, memberIds: string[]): Promise<boolean> {
  return wkFetch('/channel', {
    body: {
      channel_id: groupChannelId(groupId),
      channel_type: 2,
      subscribers: memberIds,
    },
  })
}

/** 检查 WuKongIM 是否在线（供 /api/groups/health 诊断） */
export async function wukongimHealth(): Promise<boolean> {
  const cfg = getConfig().wukongim
  if (!cfg.enabled) return false
  try {
    const res = await fetch(cfg.apiURL + '/health', { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}
