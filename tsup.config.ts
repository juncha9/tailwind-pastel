import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/extension.ts'],
    format: ['cjs'],
    target: 'node18',
    outDir: 'dist',
    external: ['vscode'],
    noExternal: [/^[@./]/], // 상대경로/alias/스코프 모두 강제 번들
    bundle: true,
    splitting: false,
    sourcemap: true,
    clean: true,
});
