// scripts/e2e_full_test.mjs
//
// 全功能端到端验证测试
// 覆盖：即时通讯（私信+群聊+多消息类型）、点赞、收藏、评论、回复
import { WKIM, WKIMChannelType, WKIMEvent } from 'easyjssdk'

const API = 'http://localhost:3000'
const WS = 'ws://localhost:5200'

let passed = 0, failed = 0
const results = []

function ok(label) { passed++; results.push(`  ✅ ${label}`); console.log(`  ✅ ${label}`) }
function fail(label, detail) { failed++; results.push(`  ❌ ${label} ${detail || ''}`); console.log(`  ❌ ${label} ${detail || ''}`) }
function section(t) { console.log(`\n${'═'.repeat(60)}\n  ${t}\n${'═'.repeat(60)}`) }

// ── Auth helper ──
async function registerLogin(username) {
  await fetch(`${API}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'e2etest123' }),
  }).catch(() => {})
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'e2etest123' }),
  })
  const cookie = res.headers.get('set-cookie') || ''
  const body = await res.json()
  return { id: body.id, username, cookie }
}

async function api(path, opts, cookie) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...opts.headers, cookie } })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

// ── IM helper ──
function createIM(uid) {
  return new Promise((resolve, reject) => {
    const im = WKIM.init(WS, { uid, token: 'wk-dev-token' })
    let settled = false
    im.on(WKIMEvent.Connect, () => { if (!settled) { settled = true; resolve(im) } })
    im.on(WKIMEvent.Error, (e) => { if (!settled) { settled = true; reject(new Error(typeof e === 'string' ? e : e?.message || 'err')) } })
    im.connect().catch(e => { if (!settled) { settled = true; reject(e) } })
    setTimeout(() => { if (!settled) { settled = true; reject(new Error('timeout')) } }, 10000)
  })
}

async function main() {
  // ════════════════════════════════════════════════════════════
  section('1. 用户注册 + 登录')
  const alice = await registerLogin('e2e_alice')
  const bob = await registerLogin('e2e_bob')
  ok(`Alice: ${alice.id}`)
  ok(`Bob: ${bob.id}`)

  // ════════════════════════════════════════════════════════════
  section('2. 私信即时通讯 — WuKongIM 实时传输')
  const aliceIM = await createIM(alice.id)
  const bobIM = await createIM(bob.id)
  ok('Alice IM 连接成功')
  ok('Bob IM 连接成功')

  const bobRecv = []
  bobIM.on(WKIMEvent.Message, (msg) => { if (msg.channelType === 1) bobRecv.push(msg) })

  // 发文本
  const r1 = await aliceIM.send(bob.id, WKIMChannelType.Person, { type: 1, text: '私信文本测试' })
  r1.reasonCode === 1 ? ok('Alice→Bob 文本: reasonCode=1') : fail('文本发送', `code=${r1.reasonCode}`)

  // 发图片
  const r2 = await aliceIM.send(bob.id, WKIMChannelType.Person, { type: 2, url: '/chat/gifs/chat.gif', w: 800, h: 400 })
  r2.reasonCode === 1 ? ok('Alice→Bob 图片: reasonCode=1') : fail('图片发送', `code=${r2.reasonCode}`)

  // 发 GIF
  const r3 = await aliceIM.send(bob.id, WKIMChannelType.Person, { type: 3, url: '/chat/gifs/feed.gif' })
  r3.reasonCode === 1 ? ok('Alice→Bob GIF: reasonCode=1') : fail('GIF发送', `code=${r3.reasonCode}`)

  await new Promise(r => setTimeout(r, 1500))
  bobRecv.length >= 3 ? ok(`Bob 实时收到 ${bobRecv.length} 条私信`) : fail(`Bob 仅收到 ${bobRecv.length} 条`)

  // 私信持久化
  section('3. 私信 API 持久化 + 历史查询')
  await api('/api/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toUserId: bob.id, text: '持久化文本', viaWK: false }),
  }, alice.cookie)

  const hist = await api(`/api/messages?peerId=${alice.id}`, {}, bob.cookie)
  hist.data.messages?.length >= 1 ? ok(`历史消息: ${hist.data.messages.length} 条`) : fail('历史查询为空')

  const summ = await api('/api/messages?summary=1', {}, bob.cookie)
  summ.data.conversations?.length > 0 ? ok(`会话列表: ${summ.data.conversations.length} 个`) : fail('会话列表为空')

  aliceIM.disconnect()
  bobIM.disconnect()

  // ════════════════════════════════════════════════════════════
  section('4. 群聊即时通讯 — WuKongIM 群频道')
  // 创建群
  const createRes = await api('/api/groups', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'E2E群聊测试' }),
  }, alice.cookie)
  if (createRes.data.id) {
    ok(`群组创建: ${createRes.data.name} (${createRes.data.id})`)
  } else {
    fail('群组创建', JSON.stringify(createRes.data).slice(0, 100))
  }
  const groupId = createRes.data.id

  // 前置：确保 Alice 关注 Bob（群邀请需好友关系）
  // 先查状态，确保是 following 而非 toggle 盲调
  const chk = await api(`/api/follows?userId=${alice.id}&check=${bob.id}`, {}, alice.cookie)
  if (chk.data.following === false) {
    await api('/api/follows', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: bob.id }),
    }, alice.cookie)
  }

  // 邀请 Bob
  const inviteRes = await api('/api/groups/invites', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, toUserId: bob.id }),
  }, alice.cookie)
  inviteRes.status < 400 ? ok('群邀请已发送') : fail('群邀请', JSON.stringify(inviteRes.data).slice(0, 100))

  // Bob 接受邀请
  const invites = await api('/api/groups/invites', {}, bob.cookie)
  const myInvite = invites.data.find(i => i.groupId === groupId)
  if (myInvite) {
    const acceptRes = await api(`/api/groups/invites/${myInvite.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' }),
    }, bob.cookie)
    acceptRes.status < 400 ? ok('Bob 接受群邀请') : fail('接受邀请', JSON.stringify(acceptRes.data).slice(0, 100))
  } else {
    fail('Bob 未找到群邀请')
  }

  // 群聊消息发送
  const aIM2 = await createIM(alice.id)
  ok('Alice 重新连接 IM（群聊测试）')

  const grpText = await aIM2.send('grp_' + groupId, WKIMChannelType.Group, { type: 1, text: '群聊消息测试！' })
  grpText.reasonCode === 1 ? ok('群聊文本: reasonCode=1') : fail('群聊文本', `code=${grpText.reasonCode}`)

  const grpGif = await aIM2.send('grp_' + groupId, WKIMChannelType.Group, { type: 3, url: '/chat/gifs/hero.gif' })
  grpGif.reasonCode === 1 ? ok('群聊GIF: reasonCode=1') : fail('群聊GIF', `code=${grpGif.reasonCode}`)

  aIM2.disconnect()

  // ════════════════════════════════════════════════════════════
  section('5. 评论 + 回复')
  // 获取一个 contentId（从首页 content 列表）
  const contentRes = await api('/api/content', {}, alice.cookie)
  const contentId = contentRes.data[0]?.id
  if (!contentId) { fail('无可用 content'); }
  else {
    ok(`目标内容: ${contentId}`)

    // Alice 发评论
    const c1 = await api('/api/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId, text: '这条评论很好看', targetType: 'content' }),
    }, alice.cookie)
    c1.data.id ? ok(`Alice 评论: "${c1.data.text}"`) : fail('评论失败', JSON.stringify(c1.data).slice(0, 100))
    const commentId = c1.data.id

    // Bob 回复 Alice 的评论
    const r1res = await api('/api/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId, text: '同意你的观点', targetType: 'content', parentId: commentId }),
    }, bob.cookie)
    r1res.data.id ? ok(`Bob 回复: "${r1res.data.text}"`) : fail('回复失败', JSON.stringify(r1res.data).slice(0, 100))

    // 查询评论列表
    const commentsList = await api(`/api/comments?contentId=${contentId}`, {}, alice.cookie)
    const total = commentsList.data.length
    total >= 2 ? ok(`评论列表: ${total} 条（含回复）`) : fail(`评论仅 ${total} 条`)

    // ════════════════════════════════════════════════════════════
    section('6. 评论点赞')
    const likeRes = await api(`/api/comments/${commentId}/like`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }, bob.cookie)
    likeRes.data.liked !== undefined ? ok(`评论点赞: liked=${likeRes.data.liked}, count=${likeRes.data.likeCount}`) : fail('评论点赞', JSON.stringify(likeRes.data).slice(0, 100))

    // 再次查询验证点赞状态
    const afterLike = await api(`/api/comments?contentId=${contentId}`, {}, alice.cookie)
    const likedComment = afterLike.data.find(c => c.id === commentId)
    likedComment?.likedBy?.includes(bob.id) ? ok(`点赞状态持久化: likedBy 含 Bob`) : fail('点赞未持久化')

    // 取消点赞
    const unlikeRes = await api(`/api/comments/${commentId}/like`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }, bob.cookie)
    unlikeRes.data.liked === false ? ok('取消点赞: liked=false') : fail('取消点赞', JSON.stringify(unlikeRes.data).slice(0, 100))
  }

  // ════════════════════════════════════════════════════════════
  section('7. 帖子（社区帖子）点赞 + 评论')
  // 获取帖子列表
  const postsRes = await api('/api/posts', {}, alice.cookie)
  let postId = postsRes.data.posts?.[0]?.id
  if (!postId) {
    // 创建一个帖子
    const newPost = await api('/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'E2E测试帖子', content: '测试内容' }),
    }, alice.cookie)
    postId = newPost.data.id
  }
  if (postId) {
    ok(`目标帖子: ${postId}`)

    // 点赞帖子
    const pl = await api(`/api/posts/${postId}/like`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }, bob.cookie)
    pl.data.liked !== undefined ? ok(`帖子点赞: liked=${pl.data.liked}, count=${pl.data.likeCount}`) : fail('帖子点赞', JSON.stringify(pl.data).slice(0, 100))

    // 取消帖子点赞
    const upl = await api(`/api/posts/${postId}/like`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }, bob.cookie)
    upl.data.liked === false ? ok('帖子取消点赞') : fail('帖子取消点赞', JSON.stringify(upl.data).slice(0, 100))
  } else {
    fail('无可用帖子')
  }

  // ════════════════════════════════════════════════════════════
  section('8. 收藏功能')
  // 创建收藏夹
  const colCreate = await api('/api/collections', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'E2E收藏夹' }),
  }, alice.cookie)
  colCreate.data.id ? ok(`收藏夹创建: "${colCreate.data.name}"`) : fail('收藏夹创建', JSON.stringify(colCreate.data).slice(0, 100))
  const colId = colCreate.data.id

  // 添加收藏项
  if (postId && colId) {
    const itemRes = await api(`/api/collections/${colId}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    }, alice.cookie)
    itemRes.status < 400 ? ok('收藏项添加成功') : fail('收藏项', JSON.stringify(itemRes.data).slice(0, 100))

    // 查询收藏列表
    const colList = await api('/api/collections', {}, alice.cookie)
    const myCol = colList.data.find(c => c.id === colId)
    myCol ? ok(`收藏夹查询: "${myCol.name}"`) : fail('收藏夹查询')
    const delRes = await api(`/api/collections/${colId}`, { method: 'DELETE' }, alice.cookie)
    delRes.status < 400 ? ok('收藏夹删除') : fail('收藏夹删除', `status=${delRes.status}`)
  }

  // ════════════════════════════════════════════════════════════
  section('9. 关注 / 取关')
  // 先确保 Alice 已关注 Bob（section 4 可能已 toggle 过）
  const f1 = await api('/api/follows', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId: bob.id }),
  }, alice.cookie)
  // 如果 f1 是 unfollow（following=false），再 toggle 回 follow
  if (f1.data.following === false) {
    await api('/api/follows', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: bob.id }),
    }, alice.cookie)
  }
  ok('Alice 关注 Bob')

  const followList = await api(`/api/follows?userId=${alice.id}&dir=following`, {}, alice.cookie)
  followList.data.users?.some(u => u.id === bob.id) ? ok('关注列表含 Bob') : fail('关注列表验证')

  // toggle: 取消关注
  const unfollowRes = await api('/api/follows', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId: bob.id }),
  }, alice.cookie)
  unfollowRes.data.following === false ? ok('取消关注: following=false') : fail('取消关注', JSON.stringify(unfollowRes.data).slice(0, 100))

  // ════════════════════════════════════════════════════════════
  section('测试结果汇总')
  console.log(`\n  通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`)
  if (failed === 0) console.log('\n  🎉 全部通过！所有功能正常。')
  else console.log(`\n  ⚠️ ${failed} 项失败`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
