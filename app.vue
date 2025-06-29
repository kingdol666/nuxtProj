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
const antdTheme = computed(() => {
  if (themeMode.value === 'dark') {
    return {
      // 使用暗黑主题算法
      algorithm: theme.darkAlgorithm,
      token: {},
      components: {
        Layout: {
          colorBgHeader: '#001529',
          colorBgBody: '#141414',
        }
      }
    };
  }

  // 默认返回亮色主题配置
  return {
    algorithm: theme.defaultAlgorithm,
    components: {
      Layout: {
        colorBgBody: '#ffffff',
      }
    }
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
/* 添加一个全局样式来处理 body 背景色，防止闪烁 */
body {
  background-color: #fff;
  transition: background-color 0.2s;
  margin: 0;
}

html.dark body {
  background-color: #141414;
  /* 这个颜色要和 antd 暗黑内容区背景色一致 */
}

.main-content-area {
  position: relative;
  background-image: url('/background.png');
  /* Corrected file extension */
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}

/* This pseudo-element creates the transparent overlay */
.main-content-area::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  /* Black overlay with 50% opacity */
  z-index: 1;
}

html.dark .main-content-area::before {
  background-color: rgba(20, 20, 20, 0.7);
  /* Darker overlay for dark mode */
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
