// composables/useCollections.ts
//
// 收藏夹状态：管理用户的收藏夹与帖子收藏关系。
import { useState, computed } from '#imports'

export interface Collection {
  id: string
  userId: string
  name: string
  description: string
  postIds: string[]
  createdAt: number
}

export const useCollections = () => {
  const collections = useState<Collection[]>('collections-list', () => [])
  const loading = useState<boolean>('collections-loading', () => false)

  async function fetchCollections() {
    loading.value = true
    try {
      const data = await $fetch<Collection[]>('/api/collections')
      collections.value = data
    } catch {
      // Not logged in or error: keep empty
      collections.value = []
    } finally {
      loading.value = false
    }
  }

  async function createCollection(name: string, description = '') {
    const c = await $fetch<Collection>('/api/collections', {
      method: 'POST',
      body: { name, description },
    })
    collections.value = [c, ...collections.value]
    return c
  }

  async function removeCollection(id: string) {
    await $fetch(`/api/collections/${id}`, { method: 'DELETE' })
    collections.value = collections.value.filter((c) => c.id !== id)
  }

  // Toggle a post in/out of a collection; returns whether it ended collected.
  async function togglePost(collectionId: string, postId: string) {
    const res = await $fetch<{ collected: boolean; postIds: string[] }>(
      `/api/collections/${collectionId}/items`,
      { method: 'POST', body: { postId } },
    )
    const c = collections.value.find((x) => x.id === collectionId)
    if (c) c.postIds = res.postIds
    return res.collected
  }

  // Is the post saved in ANY of the user's collections?
  function isPostSaved(postId: string) {
    return collections.value.some((c) => c.postIds.includes(postId))
  }

  // Which collections contain this post?
  function collectionsForPost(postId: string) {
    return collections.value.filter((c) => c.postIds.includes(postId))
  }

  const totalCount = computed(() =>
    collections.value.reduce((sum, c) => sum + c.postIds.length, 0),
  )

  return {
    collections,
    loading,
    fetchCollections,
    createCollection,
    removeCollection,
    togglePost,
    isPostSaved,
    collectionsForPost,
    totalCount,
  }
}
