import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const out = 'qa/tower-renderer-benchmark';
fs.mkdirSync(out, {recursive: true});
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
  protocolTimeout: 600000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const results = [];
try {
  for (const [name, preset, antialias] of [['balanced-aa', 'balanced', true], ['low-aa', 'low', true], ['low-no-aa', 'low', false]]) {
    const page = await browser.newPage();
    page.setDefaultTimeout(180000);
    await page.setViewport({width: 854, height: 480, deviceScaleFactor: 1});
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    if (!antialias) await page.evaluateOnNewDocument(() => {
      // Diagnostic page only: compare the same renderer with default-FBO MSAA
      // disabled at context creation. No scene or game logic changes.
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, options, ...rest) {
        if (['webgl', 'webgl2', 'experimental-webgl'].includes(kind)) return original.call(this, kind, {...options, antialias: false}, ...rest);
        return original.call(this, kind, options, ...rest);
      };
    });
    await page.goto('http://127.0.0.1:4173/?edition=foundation&level=41&debug=1', {waitUntil: 'networkidle2'});
    await page.waitForFunction(() => window.__NESI_DEMO_GAME__?.state === 'ready');
    await page.evaluate(() => window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
    await page.select('#quality-select', preset);
    const result = await page.evaluate(({name, preset}) => {
      const game = window.__NESI_DEMO_GAME__;
      const signature = () => ({state: game.state, elapsed: game.elapsed, stage: game.firstLevel.completedStages,
        player: game.playerPosition.toArray(), cargo: game.cargo.position.toArray()});
      const before = signature();
      if (before.state !== 'ready' || before.stage !== 0) throw Error('Benchmark must use the unstarted Tower');
      // A fixed visual update is not a physics step; use the ordinary spawn
      // pose and camera so all profiles compare the same production geometry.
      game.updateVisuals(0, 1);
      const canvas = document.createElement('canvas');
      canvas.width = game.renderer.domElement.width; canvas.height = game.renderer.domElement.height;
      const ctx = canvas.getContext('2d', {alpha: false});
      let lastJPEG;
      const capture = () => {
        const t0 = performance.now(); game.render(); const t1 = performance.now();
        ctx.drawImage(game.renderer.domElement, 0, 0); const t2 = performance.now();
        lastJPEG = canvas.toDataURL('image/jpeg', .84); const t3 = performance.now();
        return {renderMs: t1 - t0, readbackMs: t2 - t1, jpegMs: t3 - t2, totalMs: t3 - t0};
      };
      capture();
      const samples = Array.from({length: 12}, capture);
      const summarize = key => {
        const values = samples.map(sample => sample[key]).sort((a, b) => a - b);
        return {median: (values[5] + values[6]) / 2, mean: values.reduce((a, b) => a + b, 0) / values.length};
      };
      const after = signature();
      if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Rendering changed gameplay state');
      const gl = game.renderer.getContext();
      return {name, preset, antialias: gl.getContextAttributes().antialias, samples: gl.getParameter(gl.SAMPLES),
        dimensions: [canvas.width, canvas.height], devicePixelRatio, shadows: game.renderer.shadowMap.enabled,
        before, after, camera: game.camera.position.toArray(), calls: game.renderer.info.render.calls,
        triangles: game.renderer.info.render.triangles, warmupFrames: 1, measuredFrames: 12,
        timings: Object.fromEntries(['renderMs', 'readbackMs', 'jpegMs', 'totalMs'].map(key => [key, summarize(key)])),
        rawSamples: samples, still: lastJPEG};
    }, {name, preset});
    assert.deepEqual(result.dimensions, [854, 480]);
    assert.equal(result.devicePixelRatio, 1);
    assert.equal(result.antialias, antialias);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, `${name}.jpg`), Buffer.from(result.still.split(',')[1], 'base64'));
    delete result.still;
    result.errors = errors;
    results.push(result);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({commit: process.env.BUILD_COMMIT, results}, null, 2));
    console.log('TOWER_RENDERER_BENCHMARK', JSON.stringify(result));
    await page.close();
  }
  console.log('TOWER_RENDERER_SPEEDUPS', JSON.stringify({
    balancedToLow: results[0].timings.totalMs.median / results[1].timings.totalMs.median,
    lowAaToNoAa: results[1].timings.totalMs.median / results[2].timings.totalMs.median,
    balancedToLowNoAa: results[0].timings.totalMs.median / results[2].timings.totalMs.median,
  }));
} finally { await browser.close(); }
