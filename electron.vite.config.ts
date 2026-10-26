import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          /**
           * First paint must not wait for the editor stack. Only the shell
           * (React + local primitives + icons) belongs to the entry chunk;
           * everything else is split so it can arrive after the window is up.
           *
           * NOTE: this is a function on purpose. A static map with
           * `['@douyinfe/semi-ui']` would keep that package in the graph even
           * after every import was removed, dragging ~760 KB of CSS along.
           */
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              // Only group stable, always-together vendor code. Highlighting and
              // diagram grammars must stay split per language/diagram so they
              // keep loading on demand instead of one multi-megabyte bundle.
              if (id.includes('@douyinfe/semi-icons')) return 'icons'
              if (id.includes('codemirror') || id.includes('@lezer')) return 'cm'
              if (id.includes('prosemirror')) return 'pm'
            }

            return undefined
          }
        }
      }
    }
  }
})
