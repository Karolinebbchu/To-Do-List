import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 如需部署到 GitHub Pages 子路徑，請修改 base
  // 例如：base: '/your-repo-name/'
  base: '/',
})
