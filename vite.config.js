import { defineConfig } from 'vite';
import purgecss from '@fullhuman/postcss-purgecss';
import PluginCritical from 'rollup-plugin-critical';

// https://vitejs.dev/config/
export default defineConfig({
  // Add the critical plugin
  plugins: [
    // Run critical CSS generation only in production
    ...(process.env.NODE_ENV === 'production' ? [PluginCritical({
      criticalUrl: './dist', // Use the build output dir as base URL (for local processing)
      criticalBase: './dist', // Base directory for outputting/modifying files
      criticalPages: [
        { uri: 'index.html', template: 'index' } // Target the main index.html
      ],
      criticalConfig: {
        // Attempt to inline the critical CSS directly into the HTML
        inline: true,
        // Extract the non-critical CSS into a separate file (Vite might handle this anyway)
        extract: false,
        // Set dimensions for critical viewport
        width: 1200,
        height: 800,
        // Optional: Add penthouse options if needed
        // penthouse: {
        //   blockJSRequests: false,
        // }
      },
    })] : [])
  ],
  css: {
    postcss: {
      plugins: [
        // Only run PurgeCSS in production
        ...(process.env.NODE_ENV === 'production' ? [purgecss({
          content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'], // Adjusted scan paths
          defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || []
        })] : [])
      ]
    }
  }
  // server: {
  //   proxy: { // Example: Proxy API requests to your Express server during dev
  //     '/login': 'http://localhost:3000',
  //     '/register': 'http://localhost:3000',
  //     '/notes': 'http://localhost:3000',
  //     // Add other API routes...
  //   }
  // }
}); 