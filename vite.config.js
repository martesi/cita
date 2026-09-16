import { resolve } from 'node:path'

export default {
  root: 'site',
  base: './',
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve('site/index.html'),
        create: resolve('site/create/index.html'),
      },
    },
  },
}
