import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        home: 'home.html',
        reset_password: 'reset-password.html'
      }
    }
  },
  css: {
    postcss: {
      plugins: [
        // PurgeCSS removed
      ]
    }
  },
  server: {
    proxy: {
      '/login': 'http://localhost:3000',
      '/register': 'http://localhost:3000',
      '/notes': 'http://localhost:3000',
      '/logout': 'http://localhost:3000',
      '/forgot-password': 'http://localhost:3000',
      '/reset-password': 'http://localhost:3000',
      '/toggle-sidebar': 'http://localhost:3000',
      // Add more API endpoints here as needed
    }
  }
});