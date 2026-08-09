import { defineStore } from 'pinia'
import menuData from '~/data/menu.json'

interface MenuItem {
  id?: string
  title: string
  title_zh: string
  icon: string
}

export const useMenuStore = defineStore('menu', {
  state: () => ({
    // Seed from the bundled JSON so SSR/first paint is never empty; refresh()
    // reconciles with the live API (which reads/writes the same data file).
    menuItems: menuData as MenuItem[],
    loaded: false,
  }),
  getters: {
    getMenuItems: (state) => state.menuItems,
  },
  actions: {
    async fetchMenu() {
      try {
        const data = await $fetch<MenuItem[]>('/api/categories')
        if (Array.isArray(data) && data.length) this.menuItems = data
        this.loaded = true
      } catch (e) {
        // Keep bundled fallback on failure
        console.warn('menu fetch failed, using bundled data', e)
      }
    },
  },
})
