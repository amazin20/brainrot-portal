import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
const out = process.env.EVIDENCE_OUT || 'smoke-artifacts/w02', frames = path.join(out, 'frames');
fs.mkdirSync(frames, { recursive: true });
const report = { commit: process.env.BUILD_COMMIT || null,
  scope: 'Isolated prototype rendered in Chromium WebGL. Launch buttons initialize physical fixtures; not gameplay routes.',
  video: { width: 1280, height: 720, encodedFps: 30, physicsHz: 120, audio: false,
    note: 'Sequential native rendered frames, not measured device FPS.' }, errors: [], scenarios: [] };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true, protocolTimeout: 180000, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let frame = 0;
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 }); page.setDefaultTimeout(120000);
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(process.env.PAGE_URL || 'http://127.0.0.1:4175/prototype-distributor.html', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.__W02__?.loaded); await page.evaluate(() => window.__W02__.freeze());
  for (const [button, seconds] of [['weak', 4], ['left', 6], ['reverse', 6]]) {
    await page.click('#' + button); const initial = await page.evaluate(() => window.__W02__.snapshot());
    let last;
    for (let i = 0; i < seconds * 30; i++) {
      last = await page.evaluate(() => window.__W02__.frame(1 / 30));
      await page.screenshot({ path: path.join(frames, `${String(frame++).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 88 });
    }
    await page.screenshot({ path: path.join(out, `${button}.png`) });
    report.scenarios.push({ button, initial, final: last, seconds });
    assert.ok(last.paddleContacts > 0, 'no actual paddle contact');
    assert.ok(last.maxAngle < .67 && last.cargo.every(Number.isFinite));
    if (button === 'weak') assert.ok(last.maxAngle < .2);
    else assert.ok(last.angle * (button === 'left' ? 1 : -1) > .5);
  }
  assert.deepEqual(report.errors, []);
  const movie = path.join(out, 'distributor-prototype.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(frames, '%06d.jpg'),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', movie]);
  report.video.frames = frame; report.video.durationSeconds = frame / 30;
  report.video.sha256 = crypto.createHash('sha256').update(fs.readFileSync(movie)).digest('hex'); report.pass = true;
} catch (error) { report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(out, 'browser.json'), JSON.stringify(report, null, 2)); await browser.close(); }
