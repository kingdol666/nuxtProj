// nuxt.config.ts
import Components from 'unplugin-vue-components/vite';
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers';

export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },

  // 你已有的模块
  modules: [
    '@pinia/nuxt',
    'nuxt-particles'
  ],

  // Vite 配置，用于集成 unplugin-vue-components
  vite: {
    plugins: [
      Components({
        resolvers: [
          AntDesignVueResolver({
            // 'true' 表示自动引入 antd 的 less 样式文件
            importStyle: 'less', 
            // Antd v4+ 的图标需要单独引入，这里设置为 true 会自动处理
            resolveIcons: true,
   
          }),
        ],
      }),
    ],
    // 配置 less 变量，用于自定义 antd 主题
    css: {
      preprocessorOptions: {
        less: {
          // 在这里添加你的 less 变量来自定义 antd 主题
          modifyVars: {
            // 'primary-color': '#1DA57A',
            // 'link-color': '#1DA57A',
            // 'border-radius-base': '2px',
          },
          javascriptEnabled: true,
        },
      },
    },
  },
  
  // 不再需要从 app.head 中引入 antd 的 CSS
  // 也不再需要使用 app:created hook
})
