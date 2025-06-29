<script setup lang="ts">
import { useTheme } from '../composables/useTheme'
const { themeMode, toggleTheme } = useTheme()
import { ref, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { UserOutlined, DownOutlined, LogoutOutlined, ProfileOutlined , BulbOutlined} from '@ant-design/icons-vue';

// --- 响应式数据 ---
const username = ref('Admin'); // 你可以从 Pinia store 或 API 获取真实用户名
const route = useRoute();
const router = useRouter();

// --- 导航菜单高亮逻辑 ---
// 创建一个 ref 来存储当前选中的菜单项 key
const selectedKeys = ref<string[]>([]);

// 监听路由变化，并更新菜单的选中状态
watch(
  () => route.path,
  (newPath) => {
    // 根据路由路径来决定哪个菜单项应该高亮
    if (newPath.startsWith('/application')) {
      selectedKeys.value = ['application'];
    } else {
      // 默认/其他路径都高亮首页
      selectedKeys.value = ['home'];
    }
  },
  { immediate: true } // 立即执行一次，确保初始加载时菜单正确高亮
);

// --- 用户下拉菜单处理 ---
const handleMenuClick = ({ key }: { key: string | number }) => {
  if (key === 'logout') {
    // 在这里实现你的登出逻辑
    console.log('User wants to log out.');
    // 例如：清除 token，然后跳转到登录页
    // router.push('/login');
    alert('已觸發登出！');
  }
  if (key === 'profile') {
    router.push('/profile'); // 跳转到个人资料页
  }
};
</script>

<template>
  <a-layout-header class="header-container" :class="themeMode">
    <div class="header-content">
      <!-- 左侧区域：Logo 和导航菜单 -->
      <div class="left-section">
        <!-- Logo -->
        <div class="logo">
          <nuxt-link to="/">
            <img src="/logo.ico" alt="Site Logo" class="logo-img" />
            <div class="theme-switch">
              <AButton @click="toggleTheme" type="text">
                <BulbOutlined :style="{ color: themeMode === 'dark' ? '#ffffff' : '#888888' }" />
              </AButton>
            </div>
            <span class="logo-text">Nuxt Admin</span>
          </nuxt-link>
        </div>

        <!-- 导航菜单 -->
        <a-menu
          v-model:selectedKeys="selectedKeys"
          :theme="themeMode"
          mode="horizontal"
          class="header-menu"
          :style="{ lineHeight: '64px' }"
        >
          <a-menu-item key="home">
            <nuxt-link to="/">首页</nuxt-link>
          </a-menu-item>
          <a-menu-item key="application">
            <nuxt-link to="/application">应用推荐</nuxt-link>
          </a-menu-item>
        </a-menu>
      </div>

      <!-- 右侧区域：用户信息和操作 -->
      <div class="right-section">
        <a-dropdown>
          <!-- 下拉菜单的触发器 -->
          <a class="user-trigger" @click.prevent>
            <a-avatar :size="32" style="margin-right: 8px;">
              <template #icon><UserOutlined /></template>
              <!-- 如果有头像 URL，可以这样用: <img :src="avatarUrl" /> -->
            </a-avatar>
            <span class="username">{{ username }}</span>
            <DownOutlined style="margin-left: 8px; font-size: 12px;" />
          </a>
          
          <!-- 下拉菜单的内容 -->
          <template #overlay>
            <a-menu @click="handleMenuClick">
              <a-menu-item key="profile">
                <ProfileOutlined />
                <span style="margin-left: 8px;">个人中心</span>
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="logout" danger>
                <LogoutOutlined />
                <span style="margin-left: 8px;">退出登录</span>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>
  </a-layout-header>
</template>

<style scoped>
/* 整个头部容器 */
.header-container {
  padding: 0 24px; /* 左右留白 */
  position: sticky;
  top: 0;
  z-index: 10;
  width: 100%;
  
  /* --- Light Mode Glass Effect --- */
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
}

/* --- Dark Mode Override --- */
.header-container.dark {
  background: rgba(20, 20, 25, 0.65);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

/* 内容区，使用 flex 布局实现左右分布 */
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

/* 左侧区域容器 */
.left-section {
  display: flex;
  align-items: center;
}

/* Logo 样式 */
.logo {
  height: 64px;
  line-height: 64px;
  margin-right: 40px; /* Logo 和菜单间的距离 */
}
.logo a {
  display: flex;
  align-items: center;
  height: 100%;
}
.logo-img {
  height: 32px; /* Logo 图片高度 */
  margin-right: 12px;
}
.logo-text {
  font-size: 20px;
  font-weight: 600;
  white-space: nowrap; /* 防止文字换行 */
  
  /* --- Light Mode Text Color --- */
  color: #000000;
}

/* --- Dark Mode Override --- */
.header-container.dark .logo-text {
  color: white;
}

/* 头部导航菜单的透明背景 */
.header-menu {
  background: transparent;
  border-bottom: none;
}

/* 确保菜单项在透明背景下可读 */
.header-menu .a-menu-item a {
  transition: color 0.3s;
  
  /* --- Light Mode Menu Text Color --- */
  color: #000000;
}

.header-menu .a-menu-item-selected a,
.header-menu .a-menu-item a:hover {
  color: #000000;
}

/* --- Dark Mode Overrides --- */
.header-container.dark .header-menu .a-menu-item a {
  color: #ffffff;
}

.header-container.dark .header-menu .a-menu-item-selected a,
.header-container.dark .header-menu .a-menu-item a:hover {
  color: #ffffff;
}

/* 右侧用户区域 */
.right-section {
  display: flex;
  align-items: center;
}

/* 用户下拉菜单触发器样式 */
.user-trigger {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 100%;
  cursor: pointer;
  transition: all 0.2s;
  
  /* --- Light Mode User Trigger Color --- */
  color: #000000;
}
.user-trigger:hover {
  background: rgba(0, 0, 0, 0.04);
}

/* --- Dark Mode Overrides --- */
.header-container.dark .user-trigger {
  color: #ffffff;
}
.header-container.dark .user-trigger:hover {
  background: rgba(255, 255, 255, 0.1);
}
.username {
  font-size: 14px;
}

/* 移除 NuxtLink 的默认下划线 */
a {
  text-decoration: none;
}

/* --- Responsive Styles --- */
@media (max-width: 768px) {
  .header-container {
    padding: 0 16px; /* Reduce padding on mobile */
  }

  .logo {
    margin-right: 10px; /* Reduce margin */
  }

  .logo-text {
    display: none; /* Hide logo text on mobile */
  }

  /* Hide the main navigation menu on mobile */
  .left-section > .a-menu {
    display: none;
  }

  .username {
    display: none; /* Hide username on mobile */
  }

  .user-trigger {
    padding: 0 8px;
  }
}

@media (max-width: 480px) {
  .logo-img {
    margin-right: 8px;
  }
  .theme-switch {
    margin-left: auto;
  }
}
</style>
