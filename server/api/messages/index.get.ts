// GET /api/messages
// ?peerId=Y    → conversation between me and Y (both directions), newest last
// ?summary=1   → list of conversation partners with unread counts + last message
import { getMessages, getUsers } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const all = await getMessages()

  // ── Single conversation ──
  const peerId = query.peerId as string | undefined
  if (peerId) {
    const thread = all
      .filter(
        (m) =>
          (m.fromUserId === user.id && m.toUserId === peerId) ||
          (m.fromUserId === peerId && m.toUserId === user.id),
      )
      .sort((a, b) => a.createdAt - b.createdAt)
    // Resolve peer profile
    const users = await getUsers()
    const peer = users.find((u) => u.id === peerId)
    return {
      peer: peer
        ? { id: peer.id, username: peer.username, avatarColor: peer.avatarColor, bio: peer.bio }
        : null,
      messages: thread,
    }
  }

  // ── Conversation summary (inbox) ──
  const mine = all.filter((m) => m.fromUserId === user.id || m.toUserId === user.id)
  // Group by the other participant
  const byPeer = new Map<string, { peerId: string; last: typeof mine[number]; unread: number }>()
  for (const m of mine) {
    const other = m.fromUserId === user.id ? m.toUserId : m.fromUserId
    const existing = byPeer.get(other)
    if (!existing) {
      byPeer.set(other, {
        peerId: other,
        last: m,
        unread: m.toUserId === user.id && !m.read ? 1 : 0,
      })
    } else {
      if (m.createdAt > existing.last.createdAt) existing.last = m
      if (m.toUserId === user.id && !m.read) existing.unread += 1
    }
  }

  const users = await getUsers()
  const summary = [...byPeer.values()]
    .sort((a, b) => b.last.createdAt - a.last.createdAt)
    .map((s) => {
      const u = users.find((x) => x.id === s.peerId)
      return {
        peerId: s.peerId,
        peerUsername: u?.username || '未知用户',
        peerAvatarColor: u?.avatarColor ?? 0,
        lastText: s.last.fromUserId === user.id ? `我: ${s.last.text}` : s.last.text,
        lastCreatedAt: s.last.createdAt,
        unread: s.unread,
      }
    })

  return { conversations: summary }
})
