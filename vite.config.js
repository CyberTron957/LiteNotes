import { defineConfig } from 'vite';
import purgecss from '@fullhuman/postcss-purgecss';

// https://vitejs.dev/config/
export default defineConfig({
  // No specific config needed for now, defaults are fine
  // Build output directory defaults to 'dist'
  css: {
    postcss: {
      plugins: [
        // Only run PurgeCSS in production
        ...(process.env.NODE_ENV === 'production' ? [purgecss({
          content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,vue}'], // Files to scan for used CSS classes
          defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [] // Basic extractor, may need refinement
        })] : [])
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