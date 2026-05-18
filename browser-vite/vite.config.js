import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 3001,
        open: true,
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
                passes: 3,
                dead_code: true,
                unsafe_math: true,
                unsafe_proto: true,
            },
            mangle: {
                toplevel: true,
                properties: {
                    regex: /^_/,
                },
            },
            format: {
                comments: false,
            },
        },
        cssMinify: true,
        assetsInlineLimit: 0,
        rollupOptions: {
            output: {
                entryFileNames: 'assets/[hash].js',
                chunkFileNames: 'assets/[hash].js',
                assetFileNames: 'assets/[hash][extname]',
            },
        },
    },
});
