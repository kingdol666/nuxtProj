import { defineStore } from 'pinia'
import contentData from '~/data/content.json'

export const useContentStore = defineStore('content', {
  state: () => ({
    contentItems: contentData
  }),
  getters: {
    getContentItems: (state) => state.contentItems
  }
})
