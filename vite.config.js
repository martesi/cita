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
  environments: {
    server: {
      consumer: 'server',
      resolve: {
        noExternal: true
      },
      build: {
        target: 'node22',
        copyPublicDir: false,
        outDir: '../dist/server',
        emptyOutDir: false,
        rollupOptions: {
          input: resolve('src/index.ts'),
        },
      },
    },
  },
  builder: {},
}
