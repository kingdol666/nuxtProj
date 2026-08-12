// scripts/_fulltest.mjs — 全功能端到端验证（API 层）
// 两个用户 Alice / Bob 跑通跨用户交互：点赞 / 关注 / 私信 / 评论 / 收藏 / 评分
const BASE = 'http://localhost:3000'
const TS = Date.now()
let pass = 0, fail = 0

function cookieJar() {
  return {
    cookies: '',
    set(res) {
      const sc = res.headers.getSetCookie?.() || []
      for (const c of sc) {
        const kv = c.split(';')[0]
        const k = kv.split('=')[0]
        this.cookies = this.cookies.replace(new RegExp(k + '=[^;]*;?\\s*', 'g'), '') + kv + '; '
      }
    },
  }
}

async function req(path, opts = {}, jar) {
  let url = path
  if (opts.params) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(opts.params)) if (v != null) qs.set(k, String(v))
    url += (path.includes('?') ? '&' : '?') + qs.toString()
  }
  const headers = { ...(opts.headers || {}) }
  if (jar?.cookies) headers.cookie = jar.cookies
  let body = opts.body
  if (body && typeof body !== 'string') { headers['content-type'] = 'application/json'; body = JSON.stringify(body) }
  const res = await fetch(BASE + url, { method: opts.method, headers, body })
  if (jar) jar.set(res)
  let data = null
  const ct = res.headers.get('content-type') || ''
  if (res.status !== 204) {
    try { data = ct.includes('json') ? await res.json() : await res.text() } catch {}
  }
  return { status: res.status, data, ok: res.ok }
}

function check(name, cond, detail = '') {
  if (cond) pass++; else fail++
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'}  ${name}${!cond && detail ? '  → ' + detail : ''}`)
}

const A = cookieJar(), B = cookieJar()
const aliceUser = `alice_${TS}`, bobUser = `bob_${TS}`
let r

// ═══════════ AUTH ═══════════
console.log('\n═══ AUTH ═════')
r = await req('/api/auth/register', { method: 'POST', body: { username: aliceUser, password: 'pw_alice_1' } }, A)
check('register Alice', r.status === 200 && r.data?.username === aliceUser, `status=${r.status}`)
const aliceId = r.data?.id

r = await req('/api/auth/register', { method: 'POST', body: { username: bobUser, password: 'pw_bob_1' } }, B)
check('register Bob', r.status === 200 && r.data?.username === bobUser, `status=${r.status}`)
const bobId = r.data?.id

r = await req('/api/auth/register', { method: 'POST', body: { username: aliceUser, password: 'x' } })
check('duplicate register rejected', r.status >= 400, `status=${r.status}`)

r = await req('/api/auth/login', { method: 'POST', body: { username: aliceUser, password: 'pw_alice_1' } }, A)
check('login Alice', r.status === 200 && r.data?.username === aliceUser)
r = await req('/api/auth/login', { method: 'POST', body: { username: bobUser, password: 'wrong' } })
check('wrong password rejected', r.status >= 400)
r = await req('/api/auth/login', { method: 'POST', body: { username: bobUser, password: 'pw_bob_1' } }, B)
check('login Bob', r.status === 200 && r.data?.username === bobUser)

r = await req('/api/auth/me', {}, A)
check('GET /me authed', r.status === 200 && r.data?.id === aliceId, `data=${JSON.stringify(r.data)}`)
r = await req('/api/auth/me', {})
check('GET /me unauthed → null', r.data === null, `status=${r.status} data=${r.data}`)

// ═══════════ POSTS ═══════════
console.log('\n═══ POSTS ═════')
r = await req('/api/posts', { method: 'POST', body: { title: `Alice帖_${TS}`, content: '正文 #测试', tags: ['测试'] } }, A)
check('create post', r.status === 200 && !!r.data?.id)
const postId = r.data?.id

r = await req(`/api/posts/${postId}`, {}, A)
check('get post by id', r.data?.id === postId)

r = await req('/api/posts', {})
check('list posts', r.status === 200 && Array.isArray(r.data))

r = await req(`/api/posts/${postId}/like`, { method: 'POST' }, A)
check('self-like blocked (403)', r.status === 403, `status=${r.status}`)

r = await req(`/api/posts/${postId}/like`, { method: 'POST' }, B)
check('Bob like post', r.data?.liked === true)
r = await req(`/api/posts/${postId}/like`, { method: 'POST' }, B)
check('Bob unlike post (toggle)', r.data?.liked === false)
r = await req(`/api/posts/${postId}/like`, { method: 'POST' }, B)
check('Bob re-like post', r.data?.liked === true)

r = await req(`/api/posts/${postId}`, {}, A)
check('like persisted', (r.data?.likedBy || []).includes(bobId), `likedBy=${JSON.stringify(r.data?.likedBy)}`)

r = await req(`/api/posts/${postId}`, { method: 'PUT', body: { title: '改', content: '改后' } }, A)
check('Alice edit own post', r.status === 200)
r = await req(`/api/posts/${postId}`, { method: 'PUT', body: { title: 'hack' } }, B)
check('Bob edit blocked', r.status >= 400, `status=${r.status}`)
r = await req('/api/posts', { method: 'POST', body: { title: 'x', content: 'y' } })
check('unauth create blocked', r.status >= 400)

// ═══════════ COMMENTS ═══════════
console.log('\n═══ COMMENTS ═════')
r = await req('/api/comments', { method: 'POST', body: { contentId: postId, targetType: 'post', text: 'Bob评论' } }, B)
check('Bob comment', r.status === 200 && !!r.data?.id)
const commentId = r.data?.id

r = await req(`/api/posts/${postId}`, {}, A)
check('commentCount +1', r.data?.commentCount === 1, `count=${r.data?.commentCount}`)

r = await req('/api/comments', { method: 'POST', body: { contentId: postId, targetType: 'post', text: '回复', parentId: commentId } }, A)
check('Alice reply', r.data?.parentId === commentId)
const replyId = r.data?.id

r = await req('/api/comments', { params: { contentId: postId, targetType: 'post' } })
check('list comments (2)', r.status === 200 && r.data?.length === 2, `count=${r.data?.length}`)

r = await req('/api/comments', { method: 'POST', body: { contentId: postId, targetType: 'post', text: '   ' } }, B)
check('empty comment blocked', r.status >= 400)

r = await req(`/api/comments/${replyId}/like`, { method: 'POST' }, B)
check('Bob like reply', r.status === 200 && r.data?.liked === true, `status=${r.status}`)
r = await req('/api/comments', { params: { contentId: postId, targetType: 'post' } })
const lr = (r.data || []).find(c => c.id === replyId)
check('comment like persisted', (lr?.likedBy || []).includes(bobId))

r = await req(`/api/comments/${replyId}/like`, { method: 'POST' }, B)
check('comment unlike toggle', r.data?.liked === false)
r = await req('/api/comments', { params: { contentId: postId, targetType: 'post' } })
const ur = (r.data || []).find(c => c.id === replyId)
check('comment unlike persisted', !(ur?.likedBy || []).includes(bobId))

r = await req(`/api/comments/${commentId}/like`, { method: 'POST' }, B)
check('self-like comment blocked (403)', r.status === 403)

r = await req(`/api/comments/${commentId}`, { method: 'DELETE' }, B)
check('delete own comment', r.status === 200)
r = await req('/api/comments', { params: { contentId: postId, targetType: 'post' } })
check('reply cascade-deleted', !(r.data || []).find(c => c.id === replyId))
r = await req(`/api/posts/${postId}`, {}, A)
check('commentCount back to 0', r.data?.commentCount === 0, `count=${r.data?.commentCount}`)

// ═══════════ FOLLOWS ═══════════
console.log('\n═══ FOLLOWS ═════')
r = await req('/api/follows', { method: 'POST', body: { targetUserId: aliceId } }, B)
check('Bob follow Alice', r.status === 200, `status=${r.status}`)
r = await req('/api/feed/following', {}, B)
check('following feed', r.status === 200)
r = await req('/api/follows', { params: { userId: aliceId, dir: 'followers' } })
check('list Alice followers', r.data?.count === 1, `count=${r.data?.count}`)
r = await req('/api/follows', { method: 'POST', body: { targetUserId: bobId } }, B)
check('self-follow blocked', r.status >= 400, `status=${r.status}`)
r = await req('/api/follows', { method: 'POST', body: { targetUserId: aliceId } }, B)
check('unfollow toggle', r.status === 200)
await req('/api/follows', { method: 'POST', body: { targetUserId: aliceId } }, B)

// ═══════════ MESSAGES ═══════════
console.log('\n═══ MESSAGES ═════')
r = await req('/api/messages', { method: 'POST', body: { toUserId: aliceId, text: `私信_${TS}` } }, B)
check('Bob send message', r.status === 200 && !!r.data?.message?.id, `status=${r.status}`)
const msgId = r.data?.message?.id

r = await req('/api/messages', { params: { summary: 1 } }, A)
check('Alice inbox summary', r.status === 200 && Array.isArray(r.data?.conversations), `keys=${Object.keys(r.data||{})}`)

r = await req('/api/messages', { params: { peerId: bobId } }, A)
check('Alice conversation thread', r.status === 200 && Array.isArray(r.data?.messages), `keys=${Object.keys(r.data||{})}`)

r = await req('/api/messages/unread', {}, A)
check('Alice unread count', r.status === 200 && typeof r.data?.count === 'number', `data=${JSON.stringify(r.data)}`)

r = await req('/api/messages/read', { method: 'POST', body: { peerId: bobId } }, A)
check('Alice mark read', r.status === 200, `status=${r.status}`)
r = await req('/api/messages/unread', {}, A)
check('unread → 0 after read', r.data?.count === 0, `count=${r.data?.count}`)

r = await req('/api/messages', { method: 'POST', body: { toUserId: bobId, text: 'self' } }, B)
check('self-message blocked', r.status >= 400)
r = await req('/api/messages', { method: 'POST', body: { toUserId: aliceId, text: 'x' } })
check('unauth send blocked', r.status >= 400)

// ═══════════ COLLECTIONS ═══════════
console.log('\n═══ COLLECTIONS ═════')
r = await req('/api/collections', { method: 'POST', body: { name: `收藏夹_${TS}` } }, B)
check('create collection', r.status === 200 && !!r.data?.id)
const colId = r.data?.id

r = await req(`/api/collections/${colId}/items`, { method: 'POST', body: { postId } }, B)
check('add post to collection', r.status === 200)
r = await req('/api/collections', {}, B)
check('list collections', r.status === 200)
r = await req(`/api/collections/${colId}/items`, { method: 'POST', body: { postId } }, B)
check('remove post (toggle)', r.status === 200)
r = await req(`/api/collections/${colId}`, { method: 'DELETE' }, B)
check('delete collection', r.status === 200)

// ═══════════ RATINGS ═══════════
console.log('\n═══ RATINGS ═════')
r = await req('/api/content')
const contentId = (Array.isArray(r.data) ? r.data : [])[0]?.id
if (contentId) {
  r = await req('/api/ratings', { method: 'POST', body: { contentId, value: 4 } }, B)
  check('rate content', r.status === 200, `status=${r.status}`)
  r = await req('/api/ratings', { params: { contentId } })
  check('list ratings', r.status === 200 && typeof r.data?.avg !== 'undefined', `data=${JSON.stringify(r.data)}`)
  // update rating
  r = await req('/api/ratings', { method: 'POST', body: { contentId, value: 5 } }, B)
  check('update rating', r.status === 200 && r.data?.value === 5)
} else {
  check('ratings (skipped)', true)
}

// ═══════════ PROFILE ═══════════
console.log('\n═══ PROFILE ═════')
r = await req('/api/users/profile', { method: 'PUT', body: { bio: `简介_${TS}` } }, A)
check('update profile bio', r.status === 200 && r.data?.bio?.includes('简介'))
r = await req(`/api/users/${aliceId}/profile`, {})
check('get profile by id', r.status === 200)

// ═══════════ LOGOUT ═══════════
console.log('\n═══ LOGOUT ═════')
r = await req('/api/auth/logout', { method: 'POST' }, A)
check('logout', r.status === 200)
r = await req('/api/auth/me', {}, A)
check('me after logout → null', r.data === null, `data=${r.data}`)

// ═══════════ SUMMARY ═══════════
console.log(`\n${'═'.repeat(50)}\n  RESULT: ${pass} passed, ${fail} failed, ${pass + fail} total\n${'═'.repeat(50)}`)
process.exit(fail > 0 ? 1 : 0)
