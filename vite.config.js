import { resolve } from 'node:path'

export default {
  root: 'site',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: [resolve('site/index.html'), resolve('site/human/index.html')],
    },
  },
}
