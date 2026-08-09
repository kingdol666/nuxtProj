// app.vue

<script setup>
import { computed, reactive } from 'vue';
import { useRoute } from 'vue-router';
import Header from '~/components/Header.vue';
import Sider from '~/components/Sider.vue';
import { theme } from 'ant-design-vue';
// 1. 导入我们创建的 Composable
import { useTheme } from '~/composables/useTheme';

// 2. 获取主题状态
const { themeMode } = useTheme();

const route = useRoute();
const showParticles = computed(() => route.path === '/application');

const particlesOptions = reactive({
  background: {
    color: {
      value: 'transparent'
    }
  },
  fpsLimit: 60,
  interactivity: {
    events: {
      onClick: {
        enable: true,
        mode: 'push'
      },
      onHover: {
        enable: true,
        mode: 'repulse'
      },
      resize: true
    },
    modes: {
      bubble: {
        distance: 400,
        duration: 2,
        opacity: 0.8,
        size: 40
      },
      push: {
        quantity: 4
      },
      repulse: {
        distance: 200,
        duration: 0.4
      }
    }
  },
  particles: {
    color: {
      value: '#ffffff'
    },
    links: {
      color: '#ffffff',
      distance: 150,
      enable: true,
      opacity: 0.5,
      width: 1
    },
    collisions: {
      enable: true
    },
    move: {
      direction: 'none',
      enable: true,
      outMode: 'bounce',
      random: false,
      speed: 2,
      straight: false
    },
    number: {
      density: {
        enable: true,
        area: 800
      },
      value: 80
    },
    opacity: {
      value: 0.5
    },
    shape: {
      type: 'circle'
    },
    size: {
      random: true,
      value: 5
    }
  },
  detectRetina: true
});

// 3. 创建一个计算属性，根据 themeMode 动态返回 Antd 的主题配置
// 3. Antd 主题配置 —— 绑定全局设计系统 token(字体 / 主色 / 圆角)
//    CSS 变量在 assets/css/main.css 定义;这里同步给 antd 组件。
const FONT_SANS = "'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
const FONT_MONO = "'JetBrains Mono', 'Fira Code', Consolas, monospace";

const antdTheme = computed(() => {
  const dark = themeMode.value === 'dark';
  return {
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      fontFamily: FONT_SANS,
      fontSize: 14,
      colorPrimary: dark ? '#818cf8' : '#6366f1',
      borderRadius: 10,
      wireframe: false,
    },
    components: {
      Layout: {
        colorBgHeader: 'transparent',
        colorBgBody: 'transparent',
      },
      Menu: {
        itemSelectedBg: dark ? 'rgba(129,140,248,0.15)' : 'rgba(99,102,241,0.08)',
        itemSelectedColor: dark ? '#c7d2fe' : '#4f46e5',
        itemHoverBg: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      },
      Table: {
        headerBg: dark ? '#232330' : '#fafafa',
        rowHoverBg: dark ? 'rgba(129,140,248,0.06)' : 'rgba(99,102,241,0.04)',
      },
      Modal: {
        contentBg: dark ? '#1a1a22' : '#ffffff',
      },
      Button: {
        controlHeight: 36,
        fontWeight: 500,
      },
      Card: {
        borderRadiusLG: 16,
      },
    },
  };
});
</script>

<template>
  <a-config-provider :theme="antdTheme">
    <NuxtParticles v-if="showParticles" id="tsparticles" :options="particlesOptions" />
    <a-layout style="min-height: 100vh;">
      <Header />
      <a-layout>
        <Sider />
        <a-layout-content class="main-content-area">
          <div style="padding: 30px; position: relative; z-index: 3;">
            <NuxtPage />
          </div>
        </a-layout-content>
      </a-layout>
    </a-layout>
  </a-config-provider>
</template>

<style>
/* 全局背景已在 assets/css/main.css 通过 body::before / ::after 固定铺满整个视口；
   此处只保留布局透明与基础排版，让玻璃面板悬浮于背景之上。 */
body {
  margin: 0;
  color: var(--text-primary);
  transition: color var(--dur) var(--ease-out);
}

/* 内容区透明：露出全局背景 */
.main-content-area {
  position: relative;
  background: transparent;
}

/* 内容区顶部细微高光，增强玻璃悬浮感（不遮挡背景） */
.main-content-area::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.04), transparent 30%);
  z-index: 1;
  pointer-events: none;
}

/* --- Custom Glassmorphism Scrollbar Styles --- */
::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

/* Use a subtle, transparent background for the track */
::-webkit-scrollbar-track {
  background: transparent;
}

/* Style the thumb with a more defined glassy effect */
::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.25); /* Darker thumb for light mode visibility */
  border-radius: 10px;
  border: 2px solid rgba(255, 255, 255, 0.1); /* Keep a light border for the glassy effect */
  background-clip: padding-box;
  /* Important for border to be visible */
}

::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.45); /* Darker hover for light mode */
}

/* Dark mode scrollbar adjustments */
html.dark ::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.15);
}

html.dark ::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.4);
}

/* Style for the particles container */
#tsparticles {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  /* Position between overlay (1) and content (3) */
}
</style>
