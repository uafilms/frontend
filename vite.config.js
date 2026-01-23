import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Збільшуємо ліміт попередження (опціонально, щоб не муляло очі, але краще робити чанкінг)
    chunkSizeWarningLimit: 1000, 
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Якщо файл з node_modules
          if (id.includes('node_modules')) {
            // Виносимо важкі бібліотеки окремо
            if (id.includes('@material/web') || id.includes('lit')) {
              return 'material-web';
            }
            if (id.includes('jszip')) {
              return 'jszip';
            }
            if (id.includes('swiper')) {
              return 'swiper';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }
            // Все інше - у загальний vendor файл
            return 'vendor';
          }
        }
      }
    }
  }
})