// composables/useFollows.ts
//
// 关注关系状态：关注/取关、粉丝/关注列表、关注状态判断。
import { useState } from '#imports'

export interface PublicUser {
  id: string
  username: string
  avatarColor: number
  bio: string
}

export const useFollows = () => {
  // Array-backed cache of who the current user follows
  const followingIds = useState<string[]>('follows-following-ids', () => [])

  async function checkFollowing(targetUserId: string, viewerId: string): Promise<boolean> {
    try {
      const res = await $fetch<{ following: boolean }>('/api/follows', {
        params: { userId: viewerId, check: targetUserId },
      })
      return res.following
    } catch {
      return false
    }
  }

  async function toggleFollow(targetUserId: string): Promise<boolean> {
    const res = await $fetch<{ following: boolean }>('/api/follows', {
      method: 'POST',
      body: { targetUserId },
    })
    if (res.following) {
      if (!followingIds.value.includes(targetUserId)) followingIds.value.push(targetUserId)
    } else {
      followingIds.value = followingIds.value.filter((id) => id !== targetUserId)
    }
    return res.following
  }

  async function fetchFollowing(userId: string): Promise<PublicUser[]> {
    const res = await $fetch<{ users: PublicUser[] }>('/api/follows', {
      params: { userId, dir: 'following' },
    })
    return res.users
  }

  async function fetchFollowers(userId: string): Promise<PublicUser[]> {
    const res = await $fetch<{ users: PublicUser[] }>('/api/follows', {
      params: { userId, dir: 'followers' },
    })
    return res.users
  }

  function isFollowing(targetUserId: string): boolean {
    return followingIds.value.includes(targetUserId)
  }

  function hydrateFollowing(ids: string[]): void {
    followingIds.value = ids
  }

  return {
    followingIds,
    checkFollowing,
    toggleFollow,
    fetchFollowing,
    fetchFollowers,
    isFollowing,
    hydrateFollowing,
  }
}
