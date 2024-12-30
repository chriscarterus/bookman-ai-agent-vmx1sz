import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // React plugin configuration with optimizations
  plugins: [
    react({
      // Enable Fast Refresh for rapid development
      fastRefresh: true,
      // Use automatic JSX runtime for better performance
      jsxRuntime: 'automatic',
      // Enable babel plugins for production optimizations
      babel: {
        plugins: [
          // Remove prop-types in production
          process.env.NODE_ENV === 'production' && ['babel-plugin-transform-remove-prop-types', { removeImport: true }],
          // Enable emotion for MUI styling
          ['@emotion/babel-plugin', { sourceMap: true, autoLabel: 'dev-only' }]
        ].filter(Boolean)
      }
    })
  ],

  // Path resolution configuration
  resolve: {
    alias: {
      // Set up path alias for simplified imports matching tsconfig.json
      '@': path.resolve(__dirname, './src')
    }
  },

  // Development server configuration
  server: {
    port: 3000,
    host: true,
    strictPort: true,
    cors: true,
    // Proxy configuration for API and WebSocket endpoints
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/ws': {
        target: process.env.VITE_WEBSOCKET_URL,
        ws: true,
        changeOrigin: true
      }
    }
  },

  // Production build configuration
  build: {
    outDir: 'dist',
    // Enable source maps for debugging
    sourcemap: true,
    // Use Terser for better minification
    minify: 'terser',
    // Target modern browsers
    target: 'esnext',
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Terser options for production optimization
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    // Rollup-specific options
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: {
          // Core React dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI framework dependencies
          'vendor-mui': ['@mui/material', '@emotion/react', '@emotion/styled'],
          // Chart libraries
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          // Form handling
          'vendor-forms': ['react-hook-form', 'yup'],
          // State management
          'vendor-state': ['@reduxjs/toolkit', 'react-redux'],
          // Utility libraries
          'vendor-utils': ['date-fns', 'lodash-es', 'axios']
        },
        // Asset file naming pattern
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name.split('.').at(1);
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        // Chunk file naming pattern
        chunkFileNames: 'assets/js/[name]-[hash].js',
        // Entry file naming pattern
        entryFileNames: 'assets/js/[name]-[hash].js'
      }
    }
  },

  // Preview server configuration
  preview: {
    port: 3000,
    strictPort: true,
    // Headers for security
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  },

  // Environment variable prefix
  envPrefix: 'VITE_',

  // Global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __DEV__: process.env.NODE_ENV !== 'production'
  },

  // CSS configuration
  css: {
    devSourcemap: true,
    modules: {
      localsConvention: 'camelCase'
    }
  },

  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@emotion/react',
      '@emotion/styled'
    ],
    exclude: ['@fsba/shared-types']
  },

  // Worker configuration
  worker: {
    format: 'es',
    plugins: []
  }
});