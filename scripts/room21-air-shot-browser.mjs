import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
const tag = process.env.REVIEW_TAG || 'after', out = `smoke-artifacts/air-shot-${tag}`;
const dist = process.env.REVIEW_DIST || 'dist';
const base = process.env.PAGE_URL || 'http://127.0.0.1:4173/';
const expectBlocked = process.env.EXPECT_BLOCKED !== '0';
fs.mkdirSync(out, { recursive: true });
const assets = fs.readdirSync(path.join(dist, 'assets'));
const moduleFor = prefix => {
  const matches = assets.filter(name => name.startsWith(prefix + '-') && name.endsWith('.js'));
  assert.equal(matches.length, 1, `Exactly one ${prefix} module required`);
  return new URL('assets/' + matches[0], base).href;
};
const modules = { driver: moduleFor('LabV8Journey'), aim: moduleFor('LabRoom21Journey'),
  attempt: new URL('__review__/room21-air-shot-scenario.mjs', base).href };
const report = { tag, commit: process.env.SOURCE_COMMIT || process.env.GITHUB_SHA,
  scope: 'Real WebGL scene, shipped ordinary-input driver. Video is a native 3.33-second airborne shot excerpt, silent; complete attempt is checked separately in JSON, not a full video or device-FPS benchmark.', errors: [], pass: false };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage(); page.setDefaultTimeout(120000);
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', e => report.errors.push(e.message));
  const url = new URL(base); url.searchParams.set('level', '21'); url.searchParams.set('debug', '1'); url.searchParams.set('smoke', '1');
  await page.goto(url.href, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.__NESI_DEMO_GAME__?.state === 'playing');
  await page.evaluate(() => { const g = window.__NESI_DEMO_GAME__; g.renderer.setAnimationLoop(null); g.renderer.setPixelRatio(1); });
  const data = await page.evaluate(async modules => {
    const { runV8Journey } = await import(modules.driver);
    const { installRoom21Aim } = await import(modules.aim);
    const { room21AirShotAttempt } = await import(modules.attempt);
    const g = window.__NESI_DEMO_GAME__, frames = [], milestones = [];
    let attempt, tick = 0;
    const route = await runV8Journey(g, {
      scenario: d => {
        installRoom21Aim(d);
        attempt = room21AirShotAttempt(d, { targetU: 1.4, onFrame: phase => {
          if (phase === 'air-shot' && tick++ % 2 === 0) {
            g.render(); frames.push(g.renderer.domElement.toDataURL('image/jpeg', .86));
          }
        } });
      },
      onMilestone: mark => { g.render(); milestones.push({ ...mark, image: g.renderer.domElement.toDataURL('image/png') }); },
    });
    g.render(); return { attempt, route, frames, milestones };
  }, modules);
  report.attempt = data.attempt; report.route = data.route;
  const frames = path.join(out, 'frames'); fs.mkdirSync(frames, { recursive: true });
  data.frames.forEach((image, i) => fs.writeFileSync(path.join(frames, `${String(i).padStart(5, '0')}.jpg`), Buffer.from(image.split(',')[1], 'base64')));
  report.milestones = data.milestones.map(({ image, ...mark }, i) => {
    const file = `milestone-${i}.png`; fs.writeFileSync(path.join(out, file), Buffer.from(image.split(',')[1], 'base64')); return { ...mark, file };
  });
  assert.equal(data.frames.length, 100);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(frames, '%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, `${tag}-air-shot.mp4`)]);
  report.video = { frames: 100, encodedFps: 30, width: 1280, height: 720, audio: false };
  assert.equal(data.attempt.earlyPortal, !expectBlocked);
  assert.equal(data.attempt.shortcutWon, !expectBlocked);
  assert.equal(data.attempt.recovered, true);
  assert.equal(data.attempt.final.braked, true);
  assert.equal(data.attempt.final.loaded, false);
  assert.equal(data.route.resets + data.route.respawns, 0);
  assert.deepEqual(report.errors, []); report.pass = true;
} catch (error) { report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
