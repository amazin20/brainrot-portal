import { defineConfig } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMPAIGN_ASSETS } from './src/game/labAssets.js';

const root = path.dirname(fileURLToPath(import.meta.url));

// The repository keeps source models and its separate reference galleries.
// A playable production build ships only the campaign's declared assets.
function levelAssetBundle() {
  let outDir, mode;
  return {
    name: 'nesi-level-assets', apply: 'build',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); mode=config.mode; },
    transformIndexHtml(html) {
      // Walkthrough media is a separate website deliverable, never an SDK game asset.
      return mode==='yandex'?html.replace(/\s*<a\b[^>]*class="walkthrough-link"[^>]*>[\s\S]*?<\/a>/g,''):html;
    },
    async writeBundle() {
      const runtimeDir = path.join(root, 'public/models/runtime');
      const manifest = JSON.parse(await fs.readFile(path.join(runtimeDir, 'manifest.json'), 'utf8'));
      const selected = new Set(CAMPAIGN_ASSETS.map(asset => asset.id));
      const models = manifest.models.filter(model => selected.has(model.id));
      if (models.length !== selected.size) throw new Error('Runtime asset manifest is incomplete for campaign.');
      await fs.mkdir(path.join(outDir, 'models/runtime'), { recursive: true });
      await fs.mkdir(path.join(outDir, 'draco'), { recursive: true });
      await Promise.all(models.map(model => fs.copyFile(path.join(runtimeDir, model.filename), path.join(outDir, 'models/runtime', model.filename))));
      const compactManifest = {
        version: 8, totalBytes: models.reduce((sum, model) => sum + model.outputBytes, 0),
        totalTriangles: models.reduce((sum, model) => sum + model.triangles, 0),
        models: models.map(({ id, filename, outputBytes, outputSHA256, triangles }) => ({ id, filename, outputBytes, outputSHA256, triangles })),
      };
      await fs.writeFile(path.join(outDir, 'models/runtime/manifest.json'), JSON.stringify(compactManifest));
      await Promise.all(['draco_decoder.wasm', 'draco_wasm_wrapper.js', 'draco_decoder.js'].map(file =>
        fs.copyFile(path.join(root, 'public/draco', file), path.join(outDir, 'draco', file))));
      // Vite emits imported pictures/SVG itself. Public URLs are not copied when
      // copyPublicDir=false; retain only public images/audio actually referenced
      // by source/HTML/CSS, without shipping concepts or review screenshots.
      async function sourcesIn(directory) {
        const entries=await fs.readdir(directory,{withFileTypes:true});
        return (await Promise.all(entries.map(entry=>entry.isDirectory()?sourcesIn(path.join(directory,entry.name)):
          /\.(?:js|css|html)$/.test(entry.name)?[path.join(directory,entry.name)]:[]))).flat();
      }
      const sources=[path.join(root,'index.html'),...await sourcesIn(path.join(root,'src'))],referenced=new Set();
      for(const file of sources){
        const text=await fs.readFile(file,'utf8');
        for(const match of text.matchAll(/["'`(]((?:\.?\.?\/|\/)?[a-zA-Z0-9_./-]+\.(?:svg|png|jpe?g|webp|avif|gif|ico|ogg|mp3|wav))(?:[?#][^"'`)]*)?["'`)]/g)){
          const relative=match[1].replace(/^\.?\//,'');
          if(relative.includes('..')||relative.startsWith('src/'))continue;
          const publicPath=path.join(root,'public',relative);
          try{if((await fs.stat(publicPath)).isFile())referenced.add(relative);}catch{/* Source imports are owned by Vite. */}
        }
      }
      await Promise.all([...referenced].map(async relative=>{
        const destination=path.join(outDir,relative);await fs.mkdir(path.dirname(destination),{recursive:true});
        await fs.copyFile(path.join(root,'public',relative),destination);
      }));
      async function filesIn(directory) {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        return (await Promise.all(entries.map(entry => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
      }
      const files = await filesIn(outDir);
      const stat = await Promise.all(files.map(async file => ({ file: path.relative(outDir, file), bytes: (await fs.stat(file)).size })));
      const packageBytes = stat.reduce((sum, file) => sum + file.bytes, 0);
      console.log(`Campaign package: ${models.length} models, ${(compactManifest.totalBytes / 1e6).toFixed(2)} MB models; ${referenced.size} referenced public images/audio; ${(packageBytes / 1e6).toFixed(2)} MB complete files before ZIP. Startup transfer is measured separately.`);
    },
  };
}

export default defineConfig(({mode})=>({
  base: './',
  plugins: [levelAssetBundle()],
  build: {
    target: 'es2022',
    sourcemap: false,
    copyPublicDir: false,
    // Repeated SDK builds must not carry an obsolete hashed bundle into the ZIP.
    ...(mode==='yandex'?{emptyOutDir:true}:{}),
  },
}));
