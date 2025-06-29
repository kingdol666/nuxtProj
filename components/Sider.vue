<script setup>
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTheme } from '~/composables/useTheme';
import {
  HomeOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  UserOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue';

// --- 响应式数据 ---
const { themeMode } = useTheme();
const route = useRoute();
const collapsed = ref(false); // 控制侧边栏的收缩状态
const selectedKeys = ref([]); // 当前选中的菜单项 key
const openKeys = ref([]);     // 当前展开的 Sub-menu 菜单项 key

// --- 路由高亮逻辑 ---
// 监听路由变化，自动更新菜单的选中和展开状态
watch(
  () => route.path,
  (newPath) => {
    // 根据路由路径找到对应的菜单 key
    // 示例：/settings/users -> 选中 'settings-user', 展开 'settings'
    if (newPath.startsWith('/settings/users')) {
      selectedKeys.value = ['settings-user'];
      openKeys.value = ['settings'];
    } else if (newPath.startsWith('/settings/system')) {
      selectedKeys.value = ['settings-system'];
      openKeys.value = ['settings'];
    } else if (newPath.startsWith('/application')) {
      selectedKeys.value = ['application'];
      openKeys.value = []; // 顶级菜单，不需要展开任何子菜单
    } else {
      // 默认/首页
      selectedKeys.value = ['home'];
      openKeys.value = [];
    }
  },
  { immediate: true } // 立即执行，确保首次加载时状态正确
);
</script>

<template>
  <a-layout-sider
    v-model:collapsed="collapsed"
    collapsible
    :width="220"
    class="sider-container"
    :class="themeMode"
  >
  <a-menu
      v-model:selectedKeys="selectedKeys"
      v-model:openKeys="openKeys"
      :theme="themeMode"
      mode="inline"
      class="sider-menu"
    >
      <a-menu-item key="home">
        <template #icon><HomeOutlined /></template>
        <nuxt-link to="/">首页</nuxt-link>
      </a-menu-item>

      <a-menu-item key="application">
        <template #icon><InfoCircleOutlined /></template>
        <nuxt-link to="/application">应用推荐</nuxt-link>
      </a-menu-item>
      
      <!-- 这是一个带子菜单的示例 -->
      <a-sub-menu key="settings">
        <template #icon><SettingOutlined /></template>
        <template #title>系统设置</template>
        
        <a-menu-item key="settings-user">
          <template #icon><UserOutlined /></template>
          <nuxt-link to="/settings/users">用户管理</nuxt-link>
        </a-menu-item>
        
        <a-menu-item key="settings-system">
          <template #icon><ToolOutlined /></template>
          <nuxt-link to="/settings/system">参数配置</nuxt-link>
        </a-menu-item>
      </a-sub-menu>
    </a-menu>
  </a-layout-sider>
</template>

<style scoped>
.sider-container {
  /* Use flexbox to manage layout and prevent unwanted scrollbars */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* Set height to fill viewport below the header */
  height: calc(100vh - 64px);
  /* Make the sider sticky */
  position: sticky;
  /* Position it 64px from the top, right below the header */
  top: 64px;
  left: 0;
  z-index: 5; /* Ensure Sider is above the particle canvas */

  /* --- Light Mode Glass Effect --- */
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-right: 1px solid rgba(0, 0, 0, 0.07);
}

/* --- Dark Mode Override --- */
.sider-container.dark {
  background: rgba(20, 20, 25, 0.65);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

/* Ensure NuxtLink fills the menu item for easy clicking */
a {
  display: block;
  text-decoration: none;
}

/* --- Custom Menu Styles for Glassmorphism --- */

/* Set menu background to transparent to let the sider's blur show through */
.sider-menu {
  background: transparent;
  border-right: none; /* Remove the default border */
  flex: 1 1 auto; /* Allow menu to grow and fill available space */
  overflow-y: auto; /* Enable vertical scrolling only for the menu when needed */
  overflow-x: hidden;
}

/* Let Ant Design's dynamic theme handle the text color */
a {
  color: inherit; /* Ensure link color inherits from menu item */
}

/* Hover state for menu items */
:deep(.sider-menu.ant-menu-light .ant-menu-item:hover),
:deep(.sider-menu.ant-menu-light .ant-menu-submenu-title:hover) {
  background-color: rgba(0, 0, 0, 0.04) !important;
}

/* --- Dark Mode Hover Override --- */
.sider-container.dark :deep(.ant-menu-item:hover),
.sider-container.dark :deep(.ant-menu-submenu-title:hover) {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

/* Selected menu item style */
:deep(.sider-menu.ant-menu-light .ant-menu-item-selected) {
  background-color: rgba(0, 0, 0, 0.05) !important;
  font-weight: 600;
}
:deep(.sider-menu.ant-menu-light .ant-menu-item-selected::after) {
  border-right: 3px solid #000000;
}

/* --- Dark Mode Selected Overrides --- */
.sider-container.dark :deep(.ant-menu-item-selected) {
  background-color: rgba(138, 180, 248, 0.2) !important;
}
.sider-container.dark :deep(.ant-menu-item-selected)::after {
  border-right: 3px solid #8ab4f8;
}
.sider-container.dark :deep(.ant-menu-item-selected a),
.sider-container.dark :deep(.ant-menu-item-selected .anticon) {
  color: #ffffff !important;
}

/* Sub-menu background color */
:deep(.ant-menu-sub.ant-menu-inline) {
  background: transparent !important;
}

/* --- Style for the Collapse Trigger --- */
:deep(.ant-layout-sider-trigger) {
  /* --- Light Mode Trigger --- */
  flex-shrink: 0; /* Prevent the trigger from shrinking */
  height: 56px; /* Increase the trigger height */
  line-height: 56px; /* Center the icon vertically */
  background: transparent; /* Make it fully transparent to inherit sider's glass */
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  color: #010101;
  transition: background-color 0.3s ease;
}

:deep(.ant-layout-sider-trigger:hover) {
  color: #000000;
  background: rgba(0, 0, 0, 0.04);
}

/* --- Dark Mode Trigger Overrides --- */
.sider-container.dark :deep(.ant-layout-sider-trigger) {
  background: transparent;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: #ffffff;
  transition: background-color 0.3s ease;
}

.sider-container.dark :deep(.ant-layout-sider-trigger:hover) {
  background: rgba(255, 255, 255, 0.1); /* Lighter background on hover for feedback */
  color: #ffffff;
}
</style>
