import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { componentTagger } from "lovable-tagger"
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs'

// Custom plugin to copy public files except images folder
function selectivePublicCopy() {
  return {
    name: 'selective-public-copy',
    closeBundle() {
      const publicDir = 'public'
      const outDir = 'dist'

      // Copy files from public to dist, excluding images folder
      const copyDir = (src: string, dest: string, exclude: string[] = []) => {
        try {
          const entries = readdirSync(src, { withFileTypes: true })

          for (const entry of entries) {
            const srcPath = path.join(src, entry.name)
            const destPath = path.join(dest, entry.name)

            // Skip excluded folders
            if (exclude.includes(entry.name)) {
              continue
            }

            if (entry.isDirectory()) {
              mkdirSync(destPath, { recursive: true })
              copyDir(srcPath, destPath, exclude)
            } else {
              try {
                mkdirSync(path.dirname(destPath), { recursive: true })
                copyFileSync(srcPath, destPath)
              } catch (err) {
                // Skip files that can't be copied
              }
            }
          }
        } catch (err) {
          // Ignore errors
        }
      }

      // Copy everything except 'images', 'dist', 'js', and 'css' folders
      copyDir(publicDir, outDir, ['images', 'dist', 'js', 'css'])
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    selectivePublicCopy(),
  ].filter(Boolean),
  server: {
    host: "::",
    port: 8080
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Disable automatic copying of public directory
  publicDir: false,
}))