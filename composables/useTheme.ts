// composables/useTheme.ts

import { useState, watch, onMounted } from '#imports';
import type { Ref } from 'vue';

export const useTheme = () => {
  // 1. 创建一个 Nuxt 全局状态，并明确指定其类型
  const themeMode: Ref<'light' | 'dark'> = useState('theme', () => 'light');

  // 2. 切换主题的函数
  const toggleTheme = () => {
    themeMode.value = themeMode.value === 'light' ? 'dark' : 'light';
  };

  // 3. 监听主题变化，并更新 localStorage 和 <html> 的 class
  watch(themeMode, (newMode) => {
    if (process.client) { // 确保只在客户端执行
      localStorage.setItem('theme', newMode);
      // 为 <html> 标签添加或移除 'dark' 类
      document.documentElement.classList.toggle('dark', newMode === 'dark');
    }
  });

  // 4. 在组件挂载时，从 localStorage 读取保存的主题设置
  onMounted(() => {
    if (process.client) {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        themeMode.value = savedTheme;
      }
      // 首次加载时也设置一下 class
      document.documentElement.classList.toggle('dark', themeMode.value === 'dark');
    }
  });

  return {
    themeMode,
    toggleTheme,
  };
};
