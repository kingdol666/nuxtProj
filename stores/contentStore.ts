import { defineStore } from 'pinia'
import contentData from '~/data/content.json'

interface ContentItem {
  id?: string
  category: string
  category_zh: string
  subCategory: string
  subCategory_zh: string
  name: string
  name_zh: string
  content: string
  content_zh: string
  url: string
  rating: number
}

export const useContentStore = defineStore('content', {
  state: () => ({
    contentItems: contentData as ContentItem[],
    loaded: false,
  }),
  getters: {
    getContentItems: (state) => state.contentItems,
  },
  actions: {
    async fetchContent() {
      try {
        const data = await $fetch<ContentItem[]>('/api/content')
        if (Array.isArray(data)) this.contentItems = data
        this.loaded = true
      } catch (e) {
        console.warn('content fetch failed, using bundled data', e)
      }
    },
  },
})
