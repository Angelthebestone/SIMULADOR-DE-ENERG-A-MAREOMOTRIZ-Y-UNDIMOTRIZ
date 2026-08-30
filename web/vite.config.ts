import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { vue: "vue/dist/vue.esm-bundler.js" } },
  define: { __VUE_OPTIONS_API__: true, __VUE_PROD_DEVTOOLS__: false },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
});
