import { defineConfig } from "vite";

// Vite 配置：public/ 下的静态资源（GLB 模型）会原样发布到站点根
export default defineConfig({
  base: "/geoform-evolution-lab/",
  server: {
    host: true, // 允许局域网访问，方便手机/平板测试响应式
    open: true, // 启动后自动打开浏览器
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1500, // three.js 体积较大，提高警告阈值避免噪音
  },
});
