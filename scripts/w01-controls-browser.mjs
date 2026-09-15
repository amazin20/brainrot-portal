import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const root = process.env.PAGE_URL || 'http://127.0.0.1:4173/';
const tag = process.env.W01_TAG || 'after';
assert.match(tag, /^[a-z0-9-]+$/i);
const expected = process.env.W01_EXPECT_FIXED !== '0';
const record = process.env.W01_CAPTURE === '1';
const out = process.env.EVIDENCE_OUT || 'smoke-artifacts/w01';
fs.mkdirSync(out, { recursive: true });
const frames = path.join(out, `frames-${tag}`);
if (record) fs.mkdirSync(frames, { recursive: true });
const report = {
  tag, sourceCommit: process.env.SOURCE_COMMIT || process.env.BUILD_COMMIT || null,
  scope: 'Loaded WebGL game, real Chromium DOM and CDP touch input. Isolated control scenario, NOT a room playthrough or a physical-device benchmark.',
  video: record ? { width: 1280, height: 720, encodedFps: 30, visualStep: 1 / 30, audio: false,
    note: 'Sequential native browser frames. Physics paused to isolate camera input; frame rate is not device performance.' } : null,
  checks: {}, errors: [],
};
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true, protocolTimeout: 180000, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let frame = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, hasTouch: true });
  page.setDefaultTimeout(120000); page.on('pageerror', error => report.errors.push(error.message));
  const url = new URL(root); url.searchParams.set('debug', '1'); url.searchParams.set('smoke', '1');
  await page.goto(url.href, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.__NESI_DEMO_GAME__?.state === 'playing');
  await page.evaluate(() => window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
  const cdp = await page.createCDPSession();
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints:
    points.map(([id, x, y]) => ({ id, x, y, radiusX: 5, radiusY: 5, force: 1 })) });
  const yaw = () => page.evaluate(() => window.__NESI_DEMO_GAME__.yaw);
  const title = async text => {
    await page.evaluate(text => {
      let e = document.getElementById('control-review-label');
      if (!e) { e = document.createElement('div'); e.id = 'control-review-label';
        e.style.cssText = 'position:fixed;z-index:99;top:18px;left:18px;max-width:1150px;padding:10px 14px;background:#14252fe8;color:white;font:18px sans-serif;pointer-events:none;border-radius:8px'; document.body.append(e); }
      e.textContent = text;
    }, `${tag === 'before' ? 'ДО' : 'ПОСЛЕ'} · ${text}`);
  };
  const capture = async (count = 1) => {
    for (let i = 0; i < count; i++) {
      await page.evaluate(() => { const g = window.__NESI_DEMO_GAME__; g.updateVisuals(1 / 30, 1); g.render(); });
      if (record) await page.screenshot({ path: path.join(frames, `${String(frame++).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 87 });
    }
  };
  await title('Первое касание управляет камерой'); await capture(15);
  const initial = await yaw();
  await touch('touchStart', [[101, 650, 350]]);
  for (let x = 652; x <= 680; x += 2) { await touch('touchMove', [[101, x, 350]]); await capture(); }
  const first = await yaw();
  assert.ok(Math.abs(first - initial) > .05, 'Fixture did not deliver the initial actual touch drag');
  await title('Второй палец не должен перехватывать первое касание');
  await touch('touchStart', [[101, 680, 350], [102, 960, 360]]);
  for (let x = 682; x <= 740; x += 2) { await touch('touchMove', [[101, x, 350], [102, 960, 360]]); await capture(); }
  const second = await yaw();
  report.checks.firstFingerKeepsControl = Math.abs(second - first) > .1;
  await title('Второй палец отпущен — первый продолжает движение');
  await touch('touchEnd', [[101, 740, 350]]);
  for (let x = 742; x <= 800; x += 2) { await touch('touchMove', [[101, x, 350]]); await capture(); }
  const third = await yaw();
  report.checks.otherReleaseKeepsOwner = Math.abs(third - second) > .1;
  await touch('touchEnd', []); await capture(15);
  report.touchOwner = { initial, first, second, third };

  await title('Внешняя пауза: движение пальца не должно вращать камеру');
  await touch('touchStart', [[103, 700, 350]]);
  const beforeHold = await yaw();
  await page.evaluate(() => window.__NESI_PLATFORM__.hold('sdk', true));
  for (let x = 703; x <= 790; x += 3) { await touch('touchMove', [[103, x, 350]]); await capture(); }
  const duringHold = await yaw();
  await title('После паузы требуется новое касание');
  await page.evaluate(() => window.__NESI_PLATFORM__.hold('sdk', false));
  for (let x = 792; x <= 850; x += 2) { await touch('touchMove', [[103, x, 350]]); await capture(); }
  const afterHold = await yaw();
  await touch('touchEnd', []); await capture(15);
  report.checks.externalPauseFreezesCamera = Math.abs(duringHold - beforeHold) < 1e-9;
  report.checks.resumeRequiresFreshTouch = Math.abs(afterHold - duringHold) < 1e-9;
  report.externalPause = { beforeHold, duringHold, afterHold };
  report.checks.multiplePauseReasons = await page.evaluate(() => {
    const g = window.__NESI_DEMO_GAME__, p = window.__NESI_PLATFORM__;
    g.togglePause(true); p.hold('sdk', true); p.hold('ad', true); p.hold('sdk', false);
    const held = g.externalBlocked; p.hold('ad', false);
    return held && !g.externalBlocked && g.state === 'paused';
  });
  await page.screenshot({ path: path.join(out, `${tag}-paused.png`) });
  report.checks.noRuntimeErrors = report.errors.length === 0;
  report.loading = await page.evaluate(() => window.__NESI_DEMO_GAME__.loadingProfile);
  await page.close();

  const normal = await browser.newPage(); await normal.setViewport({ width: 1280, height: 720 });
  normal.setDefaultTimeout(120000); normal.on('pageerror', error => report.errors.push(error.message));
  await normal.goto(root, { waitUntil: 'networkidle2' });
  await normal.waitForFunction(() => document.documentElement.dataset.runtimeState === 'ready');
  await normal.click('#play-button');
  await normal.waitForFunction(() => document.body.dataset.playState === 'playing');
  report.checks.normalUiNoDiagnostics = await normal.evaluate(() => !document.querySelector('.lab-fps'));
  report.checks.normalUiNoHintButton = await normal.evaluate(() => getComputedStyle(document.getElementById('hint-button')).display === 'none');
  report.checks.normalUiKeepsTutorial = await normal.evaluate(() => !!document.querySelector('.lab-tutorial'));
  await normal.screenshot({ path: path.join(out, `${tag}-normal-game.png`) });
  await normal.close();
  if (record) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(frames, '%06d.jpg'),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, `${tag}-controls.mp4`)], { stdio: 'inherit' });
    report.video.frames = frame; report.video.durationSeconds = frame / 30;
  }
  report.pass = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
  if (expected) assert.ok(report.pass, JSON.stringify(report.checks));
} catch (error) {
  report.failure = error.stack; throw error;
} finally {
  fs.writeFileSync(path.join(out, `${tag}.json`), JSON.stringify(report, null, 2));
  await browser.close();
}
