// server/plugins/seed-admin.ts
//
// 启动时确保默认管理员账号存在（admin / admin23）。
// 若已存在则不覆盖，幂等安全；在 serverCreated 钩子执行（仅服务端）。
import { updateUsers, type User } from '~~/server/utils/db'
import { hashPassword } from '~~/server/utils/auth'

const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin23'

export default defineNitroPlugin(async () => {
  await updateUsers(async (users) => {
    const exists = users.some(
      (u) => u.username.toLowerCase() === ADMIN_USERNAME.toLowerCase(),
    )
    if (exists) return { seeded: false }

    const admin: User = {
      id: 'admin-root',
      username: ADMIN_USERNAME,
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      role: 'admin',
      avatarColor: 0,
      avatarUrl: '',
      backgroundUrl: '',
      bio: '系统管理员',
      createdAt: Date.now(),
    }
    users.push(admin)
    return { seeded: true }
  }).catch(() => {
    // 忽略写入失败（只读 FS）：站点仍可用，仅无种子管理员
  })
})
