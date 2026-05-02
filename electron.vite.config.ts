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
          manualChunks: {
            semi: ['@douyinfe/semi-ui', '@douyinfe/semi-icons'],
            editor: [
              '@codemirror/state',
              '@codemirror/view',
              '@codemirror/commands',
              '@codemirror/lang-markdown',
              '@codemirror/language',
              '@codemirror/search'
            ],
            prosemirror: [
              'prosemirror-state',
              'prosemirror-view',
              'prosemirror-model',
              'prosemirror-schema-list',
              'prosemirror-markdown',
              'prosemirror-history',
              'prosemirror-keymap',
              'prosemirror-commands',
              'prosemirror-inputrules'
            ],
            markdown: [
              'markdown-it',
              'markdown-it-task-lists',
              'markdown-it-texmath',
              'markdown-it-multimd-table',
              'highlight.js',
              'dompurify',
              'katex'
            ]
          }
        }
      }
    }
  }
})
