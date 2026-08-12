// composables/usePosts.ts
//
// 社区帖子状态：SSR 安全的 useState + 懒加载。
// 提供 fetch / create / remove / toggleLike 等操作，与服务端 API 对接。
import { useState, computed } from '#imports'

export interface Post {
  id: string
  userId: string
  username: string
  avatarColor: number
  title: string
  content: string
  images: string[]
  videos: string[]
  tags: string[]
  likedBy: string[]
  collectedBy: string[]
  commentCount: number
  createdAt: number
  updatedAt: number
}

export interface CreatePostPayload {
  title: string
  content: string
  images?: string[]
  videos?: string[]
  tags?: string[]
  coverGradient?: number
  useCoverGen?: boolean
}

export const usePosts = () => {
  const posts = useState<Post[]>('posts-list', () => [])
  const loading = useState<boolean>('posts-loading', () => false)
  const error = useState<boolean>('posts-error', () => false)
  const hasMore = useState<boolean>('posts-has-more', () => true)
  const PAGE_SIZE = 20

  async function fetchPosts(opts?: { tag?: string; keyword?: string; userId?: string }) {
    loading.value = true
    error.value = false
    try {
      const params: Record<string, string> = {}
      if (opts?.tag) params.tag = opts.tag
      if (opts?.keyword) params.keyword = opts.keyword
      if (opts?.userId) params.userId = opts.userId
      const data = await $fetch<Post[]>('/api/posts', { params })
      posts.value = data
      hasMore.value = data.length >= PAGE_SIZE
    } catch {
      // Network/server failure: keep the existing list (stale beats empty)
      // and surface failure so the UI can show a retry affordance.
      error.value = true
    } finally {
      loading.value = false
    }
  }

  async function fetchPost(id: string): Promise<Post | null> {
    try {
      return await $fetch<Post>(`/api/posts/${id}`)
    } catch {
      return null
    }
  }

  async function createPost(payload: CreatePostPayload) {
    const post = await $fetch<Post>('/api/posts', {
      method: 'POST',
      body: payload,
    })
    posts.value = [post, ...posts.value]
    return post
  }

  async function removePost(id: string) {
    await $fetch(`/api/posts/${id}`, { method: 'DELETE' })
    posts.value = posts.value.filter((p) => p.id !== id)
  }

  async function toggleLike(id: string) {
    const { user } = useAuth()
    const res = await $fetch<{ liked: boolean; likeCount: number }>(`/api/posts/${id}/like`, { method: 'POST' })
    const p = posts.value.find((x) => x.id === id)
    const uid = user.value?.id
    if (p && uid) {
      if (res.liked) {
        if (!p.likedBy.includes(uid)) p.likedBy.push(uid)
      } else {
        p.likedBy = p.likedBy.filter((u) => u !== uid)
      }
    }
    return res
  }

  async function updatePost(id: string, payload: Partial<CreatePostPayload>) {
    const updated = await $fetch<Post>(`/api/posts/${id}`, { method: 'PUT', body: payload })
    const idx = posts.value.findIndex((x) => x.id === id)
    if (idx !== -1) posts.value[idx] = { ...posts.value[idx], ...updated }
    return updated
  }

  function canLike(post: Post, userId: string | undefined): boolean {
    // 不能给自己的帖子点赞
    return !!userId && post.userId !== userId
  }

  function isLikedBy(post: Post, userId: string | undefined) {
    return !!userId && post.likedBy.includes(userId)
  }

  function isCollectedBy(post: Post, userId: string | undefined) {
    return !!userId && post.collectedBy.includes(userId)
  }

  // All unique tags across loaded posts (for filter chips)
  const allTags = computed(() => {
    const set = new Set<string>()
    for (const p of posts.value) for (const t of p.tags) set.add(t)
    return [...set].sort()
  })

  return {
    posts,
    loading,
    error,
    hasMore,
    PAGE_SIZE,
    fetchPosts,
    fetchPost,
    createPost,
    removePost,
    updatePost,
    toggleLike,
    canLike,
    isLikedBy,
    isCollectedBy,
    allTags,
  }
}
