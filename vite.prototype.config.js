import { defineConfig } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
export default defineConfig({ base: './', build: { outDir: 'prototype-dist', copyPublicDir: false,
  target: 'es2022', rollupOptions: { input: 'prototype-distributor.html' } }, plugins: [{ name: 'isolated-prototype-assets',
  async writeBundle() {
    for (const file of ['models/runtime/model-02-cargo.glb', 'draco/draco_decoder.wasm', 'draco/draco_wasm_wrapper.js', 'draco/draco_decoder.js']) {
      const dest = path.join('prototype-dist', file); await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.copyFile(path.join('public', file), dest);
    }
  } }] });
