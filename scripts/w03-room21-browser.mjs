import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const variant = process.env.W03_ROUTE || 'cargo-first';
assert.ok(['cargo-first', 'scout-first', 'recovery'].includes(variant));
const part = Number(process.env.W03_PART || 0), parts = Number(process.env.W03_PARTS || 1);
assert.ok(Number.isInteger(parts) && parts >= 1 && parts <= 16);
assert.ok(Number.isInteger(part) && part >= 0 && part < parts);
const options = variant === 'recovery' ? { recovery: true } : { order: variant };
const out = process.env.EVIDENCE_OUT || `smoke-artifacts/w03-${variant}/part-${part}`;
const frames = path.join(out, 'frames'); fs.mkdirSync(frames, { recursive: true });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const report = { part, parts, commit: process.env.BUILD_COMMIT || null, variant, parameters: options, pass: false,
  scope: 'Complete ordinary room21 route. Real game movement/aim/fire/interaction. No actor assignments after route reset; identity and reset counters are asserted by the shared driver.',
  renderer: 'Chromium WebGL / SwiftShader: not a physical-device performance measurement',
  video: { width: 1280, height: 720, encodedFps: 30, physicsHz: 120, visualHz: 60, audio: false,
    note: 'Silent recording of every second sequential native game frame. Simulation playback is normal speed, not wall-clock rendering speed.' },
  errors: [], frames: [], milestones: [], models: [] };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true, protocolTimeout: 1680000, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage(); page.setDefaultTimeout(120000);
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  page.on('pageerror', e => report.errors.push(e.message));
  await page.exposeFunction('__W03_WRITE_FRAME__', (index, image, state) => {
    assert.equal(index, part + report.frames.length * parts, 'Native capture delivery is out of order');
    const bytes = Buffer.from(image.split(',')[1], 'base64');
    fs.writeFileSync(path.join(frames, `${String(index).padStart(6, '0')}.jpg`), bytes);
    report.frames.push({ index, ...state, sha256: sha(bytes) });
    if (report.frames.length % 100 === 0) console.log('Native frames written', variant, part, report.frames.length);
  });
  const base = process.env.PAGE_URL || 'http://127.0.0.1:4173/';
  const url = new URL(base); url.searchParams.set('level', '21'); url.searchParams.set('debug', '1');
  await page.goto(url.href, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.__NESI_DEMO_GAME__?.state === 'ready');
  assert.equal(await page.$$eval('#level-select option', list => list.length), 21);
  const manifest = JSON.parse(fs.readFileSync('public/models/runtime/manifest.json', 'utf8'));
  for (const id of [1, 2, 11, 23, 24]) {
    const model = manifest.models.find(m => m.id === id);
    const bytes = Buffer.from(await (await fetch(new URL(`models/runtime/${model.filename}`, base))).arrayBuffer());
    assert.equal(sha(bytes), model.outputSHA256); report.models.push({ id, bytes: bytes.length, sha256: sha(bytes) });
  }
  await page.click('#play-button'); await page.waitForFunction(() => window.__NESI_DEMO_GAME__.state === 'playing');
  await page.addStyleTag({ content: '.lab-fps { display:none !important } #hint-button { display:none !important }' });
  const captured = await page.evaluate(async ({ options, part, parts }) => {
    const g = window.__NESI_DEMO_GAME__; g.renderer.setAnimationLoop(null);
    g.renderer.setPixelRatio(1); g.renderer.setSize(1280, 720);
    // Only the initial presentation clock is fixed for reproducible replay.
    // Each worker then executes the complete ordinary route without state jumps.
    g.visualTime = 0;
    const original = g.updateVisuals, writes = [], marks = [], trace = [], poseHashes = []; let count = 0, index = 0;
    const text = new TextEncoder();
    const poseDigest = () => {
      const nodes = [];
      for (const root of [g.playerGroup, g.cargo.group]) root.traverse(node => nodes.push([node.name,
        node.position.toArray(), node.quaternion.toArray(), node.scale.toArray(), node.morphTargetInfluences || null]));
      const visual = { nodes, camera: [g.camera.position.toArray(), g.camera.quaternion.toArray(),
        g.camera.up.toArray(), g.camera.projectionMatrix.toArray()], time: g.visualTime,
        portals: g.portals.portals.map(p => p ? [p.position.toArray(), p.normal.toArray(), p.quaternion.toArray()] : null) };
      return crypto.subtle.digest('SHA-256', text.encode(JSON.stringify(visual))).then(bytes =>
        Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join(''));
    };
    const encode = () => {
      const state = { visualFrame: count, elapsedMs: g.elapsed, player: g.playerPosition.toArray(), cargo: g.cargo.position.toArray(),
        cargoBodyId: g.physics.cargoBody.id, state: g.state, guardProgress: g.firstLevel.state.freightGuard.progress };
      trace.push({ index, ...state }); poseHashes.push(poseDigest());
      if (index % parts === part) { g.render(); writes.push(window.__W03_WRITE_FRAME__(index,
        g.renderer.domElement.toDataURL('image/jpeg', .86), state)); }
      index++;
    };
    window.__NESI_CAPTURE_LEVEL_MARK__ = mark => marks.push({ ...mark, encodedFrame: Math.max(0, index - 1) });
    g.updateVisuals = function(...args) {
      original.apply(this, args); if (args[0] > 0) { if (count % 2 === 0) encode(); count++; }
    };
    try {
      const route = await window.__NESI_RUN_LEVEL_ROUTE__(options);
      // Include the first real won frame if victory fell between capture ticks.
      for (let n = 0; n < 2 && g.state === 'won' && trace.at(-1)?.state !== 'won'; n++) g.updateVisuals(1 / 60, 1);
      await Promise.all(writes);
      const digests = await Promise.all(poseHashes);
      trace.forEach((state, i) => { state.poseSHA256 = digests[i]; });
      return { route, marks, trace, totalFrames: index, frames: writes.length, loading: g.loadingProfile, diagnostics: g.diagnostics(),
        scene: { ...g.renderer.info.render, geometries: g.renderer.info.memory.geometries, textures: g.renderer.info.memory.textures } };
    } finally { g.updateVisuals = original; delete window.__NESI_CAPTURE_LEVEL_MARK__; }
  }, { options, part, parts });
  assert.ok(captured.route.pass && captured.route.respawns === 0 && captured.route.resets === 0);
  assert.equal(captured.route.level, 21); assert.equal(captured.frames, report.frames.length);
  assert.ok(captured.totalFrames > 300 && report.frames.length > 0, 'Not a complete meaningful route recording');
  assert.equal(new Set(report.frames.map(f => f.cargoBodyId)).size, 1);
  for (let i = 1; i < report.frames.length; i++) {
    assert.equal(report.frames[i].visualFrame - report.frames[i - 1].visualFrame, 2 * parts);
    assert.ok(report.frames[i].elapsedMs >= report.frames[i - 1].elapsedMs);
  }
  for (const [index, mark] of captured.marks.entries()) {
    const file = `${String(mark.encodedFrame).padStart(6, '0')}.jpg`;
    if (mark.encodedFrame % parts !== part) continue;
    fs.copyFileSync(path.join(frames, file), path.join(out, `milestone-${String(index).padStart(2, '0')}.jpg`));
  }
  await page.screenshot({ path: path.join(out, 'joint-exit.png') });
  assert.deepEqual(report.errors, []);
  const movie = path.join(out, `${variant}.mp4`);
  if (parts === 1) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(frames, '%06d.jpg'),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', movie]);
  }
  report.video.frames = captured.totalFrames; report.video.durationSeconds = captured.totalFrames / 30;
  report.video.sha256 = parts === 1 ? sha(fs.readFileSync(movie)) : null;
  Object.assign(report, { trace: captured.trace, route: captured.route, milestones: captured.marks, loading: captured.loading,
    scene: captured.scene, diagnostics: captured.diagnostics, pass: true });
  console.log('ROOM21 NATIVE ROUTE PASSED', variant, report.video.durationSeconds, 'seconds');
} catch (error) { report.failure = error.stack; throw error; }
finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
