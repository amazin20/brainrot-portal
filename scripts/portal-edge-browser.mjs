import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

/** CI WebGL evidence for the user's floor/wall portal video. This harness
 * executes the shared ordinary-control route and samples the production
 * render at 15 simulation frames per second, without a separate camera. */
export async function runPortalEdgeBrowser({ browser, baseUrl = 'http://127.0.0.1:4173/',
  out = 'portal-edge-evidence', capture = true } = {}) {
  assert.ok(browser, 'Use the existing CI browser harness');
  fs.mkdirSync(out, { recursive: true });
  const report = { pass: false, baseUrl, capture, kind: 'v24-portal-camera', errors: [], networkFailures: [], scenarios: [],
    renderer: 'Production WebGL / CI Chromium SwiftShader',
    limits: 'Ordinary controls and the production third-person camera; 15 Hz simulation samples, not measured real-time gameplay FPS.' };
  const started = Date.now(), page = await browser.newPage();
  page.setDefaultTimeout(90000);
  await page.setViewport({ width: 960, height: 600, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('response', response => {
    if (response.status() >= 400) report.networkFailures.push({ url: response.url(), status: response.status() });
  });
  const saveImage = (file, data) => {
    const bytes = Buffer.from(data.split(',')[1], 'base64');
    fs.writeFileSync(path.join(out, file), bytes);
    return { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  };
  try {
    for (const spec of [
      { name: 'floor-rim', options: { offset: .7, sprint: false, carrying: false, reverse: false } },
      { name: 'wall-return-with-friend', options: { offset: 0, sprint: false, carrying: true, reverse: true } },
      { name: 'jump-and-turn', options: { offset: 0, sprint: false, carrying: false, reverse: false, jump: true, turn: true } },
    ]) {
      const url = new URL(baseUrl); url.searchParams.set('debug', '1'); url.searchParams.set('level', '9');
      await page.goto(url.href, { waitUntil: 'networkidle2' });
      await page.waitForFunction(() => window.__NESI_DEMO_GAME__?.state === 'ready'
        && typeof window.__NESI_RUN_PORTAL_EDGE_ROUTE__ === 'function');
      await page.click('#play-button');
      await page.waitForFunction(() => window.__NESI_DEMO_GAME__?.state === 'playing');
      const captured = await page.evaluate(async ({ options, capture }) => {
        const game = window.__NESI_DEMO_GAME__, images = [], timeline = [];
        window.__NESI_CAPTURE_PORTAL_EDGE_FRAME__ = sample => {
          if (sample.frame % 4 !== 0 || timeline.length >= 48) return;
          if (capture) { game.render(); images.push(game.renderer.domElement.toDataURL('image/png')); }
          timeline.push({ ...sample, grounded: game.playerGrounded,
            cargoHeld: game.heldCube === game.cargo, cargo: game.cargo.position.toArray(),
            cameraQuaternion: game.camera.quaternion.toArray() });
        };
        try {
          const result = await window.__NESI_RUN_PORTAL_EDGE_ROUTE__(options);
          game.render();
          return { ...result, images, timeline, finalImage: capture ? game.renderer.domElement.toDataURL('image/png') : null };
        } finally { delete window.__NESI_CAPTURE_PORTAL_EDGE_FRAME__; }
      }, { options: spec.options, capture });
      const { images, finalImage, ...data } = captured;
      const item = { name: spec.name, options: spec.options, ...data,
        sampledSimulationFps: 15, sampledFrames: captured.timeline.length, frames: [], finalImage: null };
      if (capture) {
        fs.mkdirSync(path.join(out, spec.name), { recursive: true });
        images.forEach((image, index) => item.frames.push(saveImage(`${spec.name}/${String(index).padStart(3, '0')}.png`, image)));
        item.finalImage = saveImage(`${spec.name}-complete.png`, finalImage);
      }
      report.scenarios.push(item);
      assert.equal(captured.route.pass, true, spec.name);
      assert.equal(captured.route.resets + captured.route.respawns, 0, spec.name);
      assert.equal(captured.travel.teleports, 1, spec.name);
      assert.ok(captured.travel.minY > -1.3, `${spec.name}: traveller escaped below the portal throat`);
      assert.ok(captured.travel.minCameraDistance > 2.7, `${spec.name}: camera folded into the character`);
      assert.ok(Math.abs(captured.travel.finalPitch + .5) < .001,
        `${spec.name}: passage changed the user's selected mouse pitch`);
      assert.ok(captured.timeline.filter(frame => frame.teleports > 0).every(frame => frame.camera[1] > .1),
        `${spec.name}: recovering camera escaped under the physical room floor`);
      assert.ok(captured.timeline.length >= 36 && captured.timeline.length <= 48, 'The complete passage needs 36–48 real simulation frames');
      if (capture) assert.equal(images.length, captured.timeline.length);
      assert.ok(captured.timeline.some(frame => frame.teleports === 0));
      assert.ok(captured.timeline.some(frame => frame.teleports === 1));
      if (spec.options.carrying) assert.ok(captured.timeline.every(frame => frame.cargoHeld), 'The same friend must remain in hand');
      console.log('Portal edge ordinary route passed', spec.name, captured.travel.frames);
    }
    const optional = new Set(['/favicon.ico', '/.well-known/appspecific/com.chrome.devtools.json']);
    report.optionalRequests = report.networkFailures.filter(item => item.status === 404 && optional.has(new URL(item.url).pathname));
    assert.deepEqual(report.networkFailures.filter(item => !report.optionalRequests.includes(item)), []);
    assert.deepEqual(report.errors, []);
    report.pass = true;
    return report;
  } catch (error) {
    report.error = String(error);
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    report.wallDurationMs = Date.now() - started;
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await page.close();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    headless: true, timeout: 60000, protocolTimeout: 240000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    await runPortalEdgeBrowser({ browser, baseUrl: process.env.PORTAL_EDGE_URL || 'http://127.0.0.1:4173/',
      out: process.env.PORTAL_EDGE_OUT || 'portal-edge-evidence', capture: process.env.PORTAL_EDGE_CAPTURE !== '0' });
  } finally { await browser.close(); }
}
