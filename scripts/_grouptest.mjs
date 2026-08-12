// scripts/_grouptest.mjs — 群聊业务逻辑验证（WuKongIM 离线时降级，业务落库应正常）
const BASE = 'http://localhost:3000'
const TS = Date.now()
let pass = 0, fail = 0

function cookieJar() {
  return { cookies: '', set(res) {
    const sc = res.headers.getSetCookie?.() || []
    for (const c of sc) { const kv = c.split(';')[0]; const k = kv.split('=')[0]
      this.cookies = this.cookies.replace(new RegExp(k + '=[^;]*;?\\s*', 'g'), '') + kv + '; ' }
  } }
}
async function req(path, opts = {}, jar) {
  let url = path
  if (opts.params) { const qs = new URLSearchParams(); for (const [k, v] of Object.entries(opts.params)) if (v != null) qs.set(k, String(v)); url += '?' + qs.toString() }
  const headers = { ...(opts.headers || {}) }
  if (jar?.cookies) headers.cookie = jar.cookies
  let body = opts.body
  if (body && typeof body !== 'string') { headers['content-type'] = 'application/json'; body = JSON.stringify(body) }
  const res = await fetch(BASE + url, { method: opts.method, headers, body })
  if (jar) jar.set(res)
  let data = null; try { data = await res.json() } catch {}
  return { status: res.status, data }
}
const check = (n, c, d = '') => { console.log(`${c ? '✅' : '❌'} ${n}${!c && d ? ' → ' + d : ''}`); c ? pass++ : fail++ }

const A = cookieJar(), B = cookieJar()
const alice = `grp_alice_${TS}`, bob = `grp_bob_${TS}`

// 注册 + 建立好友关系（Bob 关注 Alice）
let r = await req('/api/auth/register', { method: 'POST', body: { username: alice, password: 'pw12345' } }, A)
const aliceId = r.data?.id
await req('/api/auth/register', { method: 'POST', body: { username: bob, password: 'pw12345' } }, B)
const bobId = r.data?.id === aliceId ? null : (await req('/api/auth/register', { method: 'POST', body: { username: bob, password: 'pw12345' } }, B)).data?.id
// bob 重新拿 id（上面重复注册会失败，直接登录）
const bobLogin = await req('/api/auth/login', { method: 'POST', body: { username: bob, password: 'pw12345' } }, B)
const realBobId = bobLogin.data?.id
console.log(`alice=${aliceId} bob=${realBobId}\n`)

// Bob 关注 Alice（建立好友关系，满足邀请条件）
await req('/api/follows', { method: 'POST', body: { targetUserId: aliceId } }, B)

console.log('═══ 群聊业务逻辑 ═══')
// 1. Alice 建群
r = await req('/api/groups', { method: 'POST', body: { name: `测试群_${TS}` } }, A)
check('Alice 建群', r.status === 200 && !!r.data?.id, `status=${r.status}`)
const groupId = r.data?.id

// 2. Alice 查看自己的群
r = await req('/api/groups', {}, A)
check('Alice 群列表含该群', (r.data || []).some((g) => g.id === groupId), `count=${r.data?.length}`)

// 3. 群详情
r = await req(`/api/groups/${groupId}`, {}, A)
check('群详情·成员只有 Alice', r.data?.members?.length === 1 && r.data?.members[0]?.id === aliceId, `members=${r.data?.members?.length}`)

// 4. Bob 不是成员，不能看群详情
r = await req(`/api/groups/${groupId}`, {}, B)
check('Bob 非成员看群详情被拒(403)', r.status === 403, `status=${r.status}`)

// 5. Alice 邀请 Bob（好友关系成立）
r = await req('/api/groups/invites', { method: 'POST', body: { groupId, toUserId: realBobId } }, A)
check('Alice 邀请 Bob', r.status === 200 && !!r.data?.id, `status=${r.status} ${r.data?.statusMessage || ''}`)

// 6. Bob 收到邀请
r = await req('/api/groups/invites', {}, B)
check('Bob 收到待处理邀请', (r.data || []).some((inv) => inv.groupId === groupId && inv.status === 'pending'), `count=${r.data?.length}`)

// 7. Alice 不能邀请非好友（注册一个 stranger）
const stranger = await req('/api/auth/register', { method: 'POST', body: { username: `stranger_${TS}`, password: 'pw12345' } })
const strangerId = stranger.data?.id
r = await req('/api/groups/invites', { method: 'POST', body: { groupId, toUserId: strangerId } }, A)
check('邀请非好友被拒(403)', r.status === 403, `status=${r.status}`)

// 8. Bob 同意邀请
const inviteId = (await req('/api/groups/invites', {}, B)).data?.find((inv) => inv.groupId === groupId)?.id
r = await req(`/api/groups/invites/${inviteId}`, { method: 'POST', body: { action: 'accept' } }, B)
check('Bob 同意邀请', r.status === 200 && r.data?.accepted === true, `status=${r.status}`)

// 9. Bob 现在是群成员
r = await req(`/api/groups/${groupId}`, {}, B)
check('Bob 入群后可见详情', r.status === 200 && (r.data?.members || []).some((m) => m.id === realBobId), `members=${r.data?.members?.length}`)

// 10. 群详情现在 2 人
r = await req(`/api/groups/${groupId}`, {}, A)
check('群成员变 2 人', r.data?.members?.length === 2, `count=${r.data?.members?.length}`)

// 11. Bob 退群
r = await req(`/api/groups/${groupId}`, { method: 'DELETE' }, B)
check('Bob 退群', r.status === 200, `status=${r.status}`)
r = await req(`/api/groups/${groupId}`, {}, A)
check('退群后成员回 1 人', r.data?.members?.length === 1, `count=${r.data?.members?.length}`)

// 12. Alice 解散群
r = await req(`/api/groups/${groupId}`, { method: 'DELETE' }, A)
check('Alice(群主)解散群', r.status === 200 && r.data?.dissolved === true, `status=${r.status} data=${JSON.stringify(r.data)}`)
r = await req('/api/groups', {}, A)
check('群组已从列表消失', !(r.data || []).some((g) => g.id === groupId))

console.log(`\n${'═'.repeat(50)}\n  群聊业务: ${pass} passed, ${fail} failed\n${'═'.repeat(50)}`)
process.exit(fail > 0 ? 1 : 0)
