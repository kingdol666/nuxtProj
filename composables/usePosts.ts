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
}

export const usePosts = () => {
  const posts = useState<Post[]>('posts-list', () => [])
  const loading = useState<boolean>('posts-loading', () => false)
  const hasMore = useState<boolean>('posts-has-more', () => true)
  const PAGE_SIZE = 20

  async function fetchPosts(opts?: { tag?: string; keyword?: string; userId?: string; reset?: boolean }) {
    loading.value = true
    try {
      const params: Record<string, string> = {}
      if (opts?.tag) params.tag = opts.tag
      if (opts?.keyword) params.keyword = opts.keyword
      if (opts?.userId) params.userId = opts.userId
      const data = await $fetch<Post[]>('/api/posts', { params })
      posts.value = data
      hasMore.value = data.length >= PAGE_SIZE
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
    const res = await $fetch<{ liked: boolean; likeCount: number }>(`/api/posts/${id}/like`, { method: 'POST' })
    const p = posts.value.find((x) => x.id === id)
    if (p) {
      // Reconcile likedBy length; we don't have current userId here so trust count
      p.likedBy = res.liked
        ? [...p.likedBy, '__me__']
        : p.likedBy.slice(0, Math.max(0, p.likedBy.length - 1))
    }
    return res
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
    hasMore,
    PAGE_SIZE,
    fetchPosts,
    fetchPost,
    createPost,
    removePost,
    toggleLike,
    isLikedBy,
    isCollectedBy,
    allTags,
  }
}
