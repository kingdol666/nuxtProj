// composables/useGroups.ts
//
// 群组状态：我的群组列表、群详情、创建/退群、邀请好友、待处理邀请、同意/拒绝。
import { useState } from '#imports'

export interface GroupSummary {
  id: string
  name: string
  avatarColor: number
  ownerId: string
  memberCount: number
  createdAt: number
  isOwner: boolean
}

export interface GroupMember {
  id: string
  username: string
  avatarColor: number
  avatarUrl: string
  bio: string
  isOwner: boolean
  isMe: boolean
}

export interface GroupDetail extends GroupSummary {
  members: GroupMember[]
}

export interface GroupInviteItem {
  id: string
  groupId: string
  groupName: string
  fromUserId: string
  fromUsername: string
  toUserId: string
  status: string
  createdAt: number
}

const AVATAR_PALETTE = [
  ['#6366f1', '#818cf8'], ['#ec4899', '#f9a8d4'], ['#10b981', '#34d399'],
  ['#f59e0b', '#fbbf24'], ['#3b82f6', '#60a5fa'], ['#8b5cf6', '#a78bfa'],
]

export const useGroups = () => {
  const myGroups = useState<GroupSummary[]>('groups-mine', () => [])
  const activeGroup = useState<GroupDetail | null>('groups-active', () => null)
  const invites = useState<GroupInviteItem[]>('groups-invites', () => [])
  const loading = useState<boolean>('groups-loading', () => false)

  function avatarStyle(color: number) {
    const p = AVATAR_PALETTE[color % AVATAR_PALETTE.length]
    return `background: linear-gradient(135deg, ${p[0]}, ${p[1]})`
  }

  async function fetchMyGroups(): Promise<void> {
    loading.value = true
    try {
      myGroups.value = await $fetch<GroupSummary[]>('/api/groups')
    } catch {
      myGroups.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchInvites(): Promise<void> {
    try {
      invites.value = await $fetch<GroupInviteItem[]>('/api/groups/invites')
    } catch {
      invites.value = []
    }
  }

  async function openGroup(id: string): Promise<void> {
    try {
      activeGroup.value = await $fetch<GroupDetail>(`/api/groups/${id}`)
    } catch (e: any) {
      activeGroup.value = null
      throw e
    }
  }

  async function createGroup(name: string): Promise<GroupSummary> {
    const g = await $fetch<GroupSummary>('/api/groups', { method: 'POST', body: { name } })
    await fetchMyGroups()
    return g
  }

  async function leaveGroup(id: string): Promise<void> {
    await $fetch<void>(`/api/groups/${id}`, { method: 'DELETE' })
    activeGroup.value = null
    await fetchMyGroups()
  }

  async function inviteMember(groupId: string, toUserId: string): Promise<void> {
    await $fetch('/api/groups/invites', { method: 'POST', body: { groupId, toUserId } })
  }

  async function respondInvite(inviteId: string, action: 'accept' | 'decline'): Promise<void> {
    await $fetch(`/api/groups/invites/${inviteId}`, { method: 'POST', body: { action } })
    await fetchInvites()
    if (action === 'accept') await fetchMyGroups()
  }

  return {
    myGroups,
    activeGroup,
    invites,
    loading,
    avatarStyle,
    fetchMyGroups,
    fetchInvites,
    openGroup,
    createGroup,
    leaveGroup,
    inviteMember,
    respondInvite,
  }
}
