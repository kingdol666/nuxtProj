import { defineStore } from 'pinia'
import menuData from '~/data/menu.json'

export const useMenuStore = defineStore('menu', {
  state: () => ({
    menuItems: menuData
  }),
  getters: {
    getMenuItems: (state) => state.menuItems
  }
})
