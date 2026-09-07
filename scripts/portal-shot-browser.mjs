import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

/** Real browser input regression for the first playable room. This module can
 * also be imported by the public-deployment verifier. All gameplay actions use
 * trusted browser mouse/keyboard input. Reading geometry to aim is permitted;
 * assigning actor/camera poses, placing portals, advancing time, and calling a
 * debug route are deliberately absent. Observers call each original method
 * exactly once and preserve its return value.
 *
 * Run on a normal WebGL-capable CI runner, after starting the preview server:
 *   node scripts/portal-shot-browser.mjs
 * Optional: PORTAL_SHOT_URL, PORTAL_SHOT_OUT, CHROME_PATH.
 */
export async function runPortalShotBrowser({ browser, baseUrl = 'http://127.0.0.1:4173/', out = 'portal-shot-evidence' } = {}) {
  assert.ok(browser, 'A browser supplied by the existing CI browser harness is required');
  fs.mkdirSync(out, { recursive: true });
  const report = {
    pass: false, baseUrl, renderer: 'Actual production WebGL in CI Chromium / SwiftShader',
    note: 'Ordinary room-1 spawn and trusted DOM input. Observers only; no gameplay fixtures or manual simulation. The recording requests 60 fps; measured frame timing is reported separately and is not a user-GPU benchmark.',
    errors: [], networkFailures: [], shots: [], aim: [],
  };
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.setViewport({ width: 960, height: 600, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('response', response => {
    if (response.status() >= 400) report.networkFailures.push({ url: response.url(), status: response.status() });
  });
  const snapshot = () => page.evaluate(() => {
    const g = window.__NESI_DEMO_GAME__;
    return { state: g.state, level: g.levelIndex, player: g.playerPosition.toArray(),
      serial: [...g.portalShots.serial], impact: g.portalShots.lastImpact,
      portals: g.portals.portals.map(p => p ? { position: p.position.toArray(), normal: p.normal.toArray() } : null),
      surfaceIds: [...g.portalSurfaceIds], locked: document.pointerLockElement === g.renderer.domElement,
      frames: g.renderFrames, yaw: g.yaw, pitch: g.pitch, teleports: g.teleportCount };
  });
  let mouse = { x: 480, y: 300 };
  let recordingSaved = false;

  async function saveEvidence() {
    if (recordingSaved) return;
    recordingSaved = true;
    const evidence = await page.evaluate(async () => {
      const probe = window.__NESI_MOUSE_PROBE__;
      if (!probe) return null;
      const recording = await probe.finish();
      return { ...recording, events: probe.events, trace: probe.trace,
        frames: probe.frames, start: probe.start, end: performance.now() };
    });
    if (!evidence) return;
    if (evidence.video) {
      const bytes = Buffer.from(evidence.video.split(',')[1], 'base64');
      fs.writeFileSync(path.join(out, 'mouse-portal-shots.webm'), bytes);
      report.recording = { file: 'mouse-portal-shots.webm', bytes: bytes.length,
        requestedFps: 60, mimeType: evidence.mimeType, trackSettings: evidence.trackSettings };
    } else report.recording = { requestedFps: 60, unavailable: evidence.unavailable };
    delete evidence.video;
    report.inputEvents = evidence.events;
    report.shotTrace = evidence.trace;
    const timing = evidence.frames.map(f => f.time);
    const intervals = timing.slice(1).map((time, i) => time - timing[i]).sort((a, b) => a - b);
    report.renderTiming = { sampledFrames: timing.length,
      durationMs: timing.length > 1 ? timing.at(-1) - timing[0] : 0,
      observedFps: timing.length > 1 ? (timing.length - 1) * 1000 / (timing.at(-1) - timing[0]) : 0,
      medianFrameMs: intervals[Math.floor(intervals.length / 2)] ?? null,
      p95FrameMs: intervals[Math.floor(intervals.length * .95)] ?? null };
    fs.writeFileSync(path.join(out, 'frame-timeline.json'), JSON.stringify(evidence.frames, null, 2));
  }

  // Camera-space angular errors drive the same mouse movement a person uses.
  // Geometry and the live camera are read; neither is changed by this helper.
  async function aimAt(target, label) {
    const attempts = [];
    for (let i = 0; i < 36; i++) {
      await page.waitForFunction(() => {
        const g = window.__NESI_DEMO_GAME__;
        return g.state === 'playing' && !g.externalBlocked &&
          Math.abs(Math.atan2(Math.sin(g.yaw - g.cameraRig.yaw), Math.cos(g.yaw - g.cameraRig.yaw))) < .003 &&
          Math.abs(g.pitch - g.cameraRig.pitch) < .003;
      });
      const error = await page.evaluate(target => {
        const g = window.__NESI_DEMO_GAME__;
        const v = g.playerPosition.clone().fromArray(target).sub(g.camera.position)
          .applyQuaternion(g.camera.quaternion.clone().invert());
        const ndc = g.playerPosition.clone().fromArray(target).project(g.camera);
        return { horizontal: Math.atan2(v.x, -v.z), vertical: Math.atan2(v.y, Math.hypot(v.x, v.z)),
          ndc: ndc.toArray(), yaw: g.yaw, pitch: g.pitch, frames: g.renderFrames };
      }, target);
      attempts.push(error);
      if (Math.abs(error.horizontal) < .006 && Math.abs(error.vertical) < .006 && error.ndc[2] < 1) {
        report.aim.push({ label, target, attempts });
        return;
      }
      const dx = Math.round(Math.max(-220, Math.min(220, error.horizontal * .82 / .002)));
      const dy = Math.round(Math.max(-150, Math.min(150, -error.vertical * .82 / .0018)));
      mouse = { x: mouse.x + dx, y: mouse.y + dy };
      await page.mouse.move(mouse.x, mouse.y);
      await page.waitForFunction(frames => window.__NESI_DEMO_GAME__.renderFrames >= frames + 2, {}, error.frames);
    }
    report.aim.push({ label, target, attempts });
    throw new Error(`Trusted mouse movements did not center ${label}: ${JSON.stringify(attempts.at(-1))}`);
  }

  async function shoot({ label, target, button, valid, surface }) {
    await aimAt(target, label);
    await page.waitForFunction(() => {
      const s = window.__NESI_DEMO_GAME__.portalShots;
      return s.cooldown === 0 && s.queue.length === 0 && s.active.length === 0;
    });
    const before = await snapshot(), index = button === 'left' ? 0 : 1;
    assert.equal(before.locked, true, 'Portal buttons must run under actual pointer lock');
    const traceStart = await page.evaluate(() => window.__NESI_MOUSE_PROBE__.trace.length);
    await page.screenshot({ path: path.join(out, `${report.shots.length + 1}-${label}-before.png`) });
    await page.mouse.down({ button });
    await page.mouse.up({ button });
    await page.waitForFunction(({ index, previous }) => {
      const s = window.__NESI_DEMO_GAME__.portalShots;
      return s.serial[index] > previous && s.queue.length === 0 && s.active.length === 0 &&
        s.lastImpact?.index === index && s.lastImpact?.sequence === s.serial[index];
    }, {}, { index, previous: before.serial[index] });
    const after = await snapshot();
    const trace = await page.evaluate(start => window.__NESI_MOUSE_PROBE__.trace.slice(start), traceStart);
    const item = { label, button, index, expectedValid: valid, target, before, after, trace };
    report.shots.push(item);
    await page.screenshot({ path: path.join(out, `${report.shots.length}-${label}-after.png`) });
    assert.equal(after.serial[index], before.serial[index] + 1, `${label}: one click must request exactly one shot`);
    assert.equal(after.impact?.valid, valid, `${label}: actual travelling shot impact ${JSON.stringify(after.impact)}`);
    const request = trace.find(t => t.kind === 'request' && t.index === index);
    const launch = trace.find(t => t.kind === 'launch' && t.index === index);
    const impact = trace.find(t => t.kind === 'impact' && t.index === index);
    assert.ok(request?.accepted && launch?.launched && impact, `${label}: missing request → launch → impact chain`);
    assert.deepEqual(request.portalsBefore, before.portals, 'Observer request begins with the existing portals');
    assert.deepEqual(request.portalsAfter, before.portals, 'Mouse request must not instantly place a portal');
    assert.deepEqual(launch.portalsBefore, before.portals, 'A portal appears at impact, not before projectile launch');
    assert.ok(impact.simulationTime > launch.simulationTime, 'The shot must travel on the normal physics clock');
    assert.ok(impact.travel > 0, 'A visible wall must be reached by a travelling projectile');
    assert.deepEqual(after.player, before.player, 'Stationary shooting must not move the player');
    if (valid) {
      assert.equal(after.surfaceIds[index], surface, `${label}: portal must belong to the aimed white panel`);
      assert.notEqual(after.portals[index], null);
      assert.deepEqual(after.portals[1 - index], before.portals[1 - index], 'The other portal must remain intact');
    } else {
      assert.deepEqual(after.portals, before.portals, 'Rejected surface must preserve the existing portal pair');
      assert.deepEqual(after.surfaceIds, before.surfaceIds);
    }
  }

  try {
    const url = new URL(baseUrl);
    url.searchParams.set('debug', '1');
    url.searchParams.set('level', '1');
    await page.goto(url.href, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => window.__NESI_DEMO_GAME__?.state === 'ready');
    assert.equal(await page.$eval('#level-select', select => select.value), '0');
    await page.evaluate(() => {
      const g = window.__NESI_DEMO_GAME__, shots = g.portalShots, canvas = g.renderer.domElement;
      const events = [], trace = [], frames = [], original = {};
      const portals = () => g.portals.portals.map(p => p ? { position: p.position.toArray(), normal: p.normal.toArray() } : null);
      const record = item => trace.push({ ...item, time: performance.now(), simulationTime: shots.time });
      const dom = event => {
        events.push({ type: event.type, time: performance.now(), trusted: event.isTrusted,
          button: event.button, movementX: event.movementX, movementY: event.movementY,
          target: event.target === canvas ? 'game-canvas' : event.target?.id || event.target?.tagName,
          locked: document.pointerLockElement === canvas, state: g.state });
      };
      for (const type of ['pointerdown', 'pointerup', 'mousemove', 'pointerlockchange', 'click', 'contextmenu']) {
        document.addEventListener(type, dom, true);
      }
      for (const name of ['request', 'launch', 'impact']) original[name] = shots[name];
      shots.request = function (index) {
        const before = portals(), accepted = original.request.call(this, index);
        record({ kind: 'request', index, accepted, sequence: this.serial[index],
          portalsBefore: before, portalsAfter: portals() });
        return accepted;
      };
      shots.launch = function (shot) {
        const before = portals(), result = original.launch.call(this, shot);
        const live = this.active.find(s => s.index === shot.index && s.sequence === shot.sequence);
        record({ kind: 'launch', index: shot.index, sequence: shot.sequence, launched: !!live,
          origin: live?.position.toArray(), direction: live?.direction.toArray(), portalsBefore: before });
        return result;
      };
      shots.impact = function (shot, hit) {
        const result = original.impact.call(this, shot, hit);
        record({ kind: 'impact', index: shot.index, sequence: shot.sequence, travel: shot.travel,
          collider: hit.object?.name ?? '', position: hit.point.toArray(), result: { ...this.lastImpact }, portalsAfter: portals() });
        return result;
      };
      let frameId, previousFrames = -1, running = true;
      const frame = () => {
        if (!running) return;
        if (g.renderFrames !== previousFrames) {
          previousFrames = g.renderFrames;
          frames.push({ time: performance.now(), frame: g.renderFrames,
            pending: shots.queue.length, flying: shots.active.map(s => ({ index: s.index, position: s.position.toArray() })),
            impact: shots.lastImpact, portals: portals() });
        }
        frameId = requestAnimationFrame(frame);
      };
      frameId = requestAnimationFrame(frame);
      let recorder, stream, mimeType, unavailable, trackSettings, start = performance.now();
      const chunks = [];
      try {
        mimeType = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
        if (!mimeType) throw new Error('No supported WebM encoder');
        stream = canvas.captureStream(60);
        trackSettings = stream.getVideoTracks()[0].getSettings();
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3500000 });
        recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
        recorder.start(250);
      } catch (error) { unavailable = String(error); }
      window.__NESI_MOUSE_PROBE__ = { events, trace, frames, start, async finish() {
        running = false;
        cancelAnimationFrame(frameId);
        let video;
        if (recorder && recorder.state !== 'inactive') {
          await new Promise(resolve => { recorder.addEventListener('stop', resolve, { once: true }); recorder.stop(); });
          const blob = new Blob(chunks, { type: mimeType });
          video = await new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
          });
        }
        stream?.getTracks().forEach(track => track.stop());
        for (const type of ['pointerdown', 'pointerup', 'mousemove', 'pointerlockchange', 'click', 'contextmenu']) document.removeEventListener(type, dom, true);
        for (const name of ['request', 'launch', 'impact']) shots[name] = original[name];
        return { video, mimeType, unavailable, trackSettings };
      } };
    });

    await page.click('#play-button');
    await page.waitForFunction(() => window.__NESI_DEMO_GAME__.state === 'playing');
    await page.waitForFunction(() => window.__NESI_DEMO_GAME__.renderFrames > 3);
    // Play itself normally acquires pointer lock. If the browser has deferred
    // that request, its ordinary first canvas click must only acquire the lock.
    if (!(await snapshot()).locked) {
      const before = await snapshot();
      await page.mouse.click(mouse.x, mouse.y);
      await page.waitForFunction(() => !!document.pointerLockElement);
      const after = await snapshot();
      assert.deepEqual(after.serial, before.serial, 'The first unlocked click must only acquire pointer lock');
      report.pointerLockAcquiredBy = 'first canvas click';
    } else report.pointerLockAcquiredBy = 'Play button';
    await page.mouse.move(mouse.x, mouse.y);
    report.initial = await snapshot();
    assert.equal(report.initial.level, 0);
    assert.deepEqual(report.initial.player, [0, 0, 10], 'The regression must begin at the authored room-1 spawn');
    assert.deepEqual(report.initial.serial, [0, 0]);
    assert.ok(report.initial.portals.every(p => p === null));
    const targets = await page.evaluate(() => {
      const l = window.__NESI_DEMO_GAME__.firstLevel, entry = l.panels.entry, exit = l.panels.exit;
      return { entry: entry.getFrame().center.toArray(), exit: exit.getFrame().center.toArray(),
        movedEntry: entry.getFrame().center.clone().addScaledVector(entry.getFrame().right, 1.1).toArray(),
        entryId: entry.mesh.userData.portalColliderId ?? entry.mesh.uuid,
        exitId: exit.mesh.userData.portalColliderId ?? exit.mesh.uuid,
        // The added start-wall ceramic spans y=0..4.6. Aim at the visible
        // graphite above it; y=2.1 correctly accepts portals in this room.
        darkWall: [l.bounds.maxX, 6.3, 9] };
    });
    await shoot({ label: 'blue-entry', target: targets.entry, button: 'left', valid: true, surface: targets.entryId });
    await shoot({ label: 'amber-exit', target: targets.exit, button: 'right', valid: true, surface: targets.exitId });
    assert.ok((await snapshot()).portals.every(Boolean), 'Both mouse buttons must create a connected pair');
    const firstBlue = report.shots[0].after.portals[0];
    await shoot({ label: 'blue-reposition', target: targets.movedEntry, button: 'left', valid: true, surface: targets.entryId });
    assert.notDeepEqual(report.shots[2].after.portals[0], firstBlue, 'A new blue shot must visibly reposition the blue portal');
    await shoot({ label: 'dark-wall-rejected', target: targets.darkWall, button: 'right', valid: false });
    report.final = await snapshot();
    await saveEvidence();
    const gameplayClicks = report.inputEvents.filter(e => e.type === 'pointerdown' && e.target === 'game-canvas' && e.locked);
    assert.equal(gameplayClicks.length, 4, 'Exactly four real gameplay clicks must drive all four outcomes');
    assert.ok(gameplayClicks.every(e => e.trusted), 'The test must use browser input, not dispatchEvent');
    assert.deepEqual(gameplayClicks.map(e => e.button), [0, 2, 0, 2]);
    assert.ok(report.inputEvents.some(e => e.type === 'mousemove' && e.trusted && e.locked && (e.movementX || e.movementY)), 'Aiming requires real locked mouse movement');
    const optional = new Set(['/favicon.ico', '/.well-known/appspecific/com.chrome.devtools.json']);
    report.optionalRequests = report.networkFailures.filter(r => r.status === 404 && optional.has(new URL(r.url).pathname));
    assert.deepEqual(report.networkFailures.filter(r => !report.optionalRequests.includes(r)), []);
    assert.deepEqual(report.errors, []);
    report.pass = true;
    console.log('Portal mouse regression passed: left/right/reposition/rejection through trusted DOM input', baseUrl);
    return report;
  } catch (error) {
    report.error = String(error);
    report.failureState = await snapshot().catch(() => null);
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    await saveEvidence().catch(error => { report.evidenceError = String(error); });
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await page.close();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    headless: true, protocolTimeout: 240000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    await runPortalShotBrowser({ browser, baseUrl: process.env.PORTAL_SHOT_URL || 'http://127.0.0.1:4173/',
      out: process.env.PORTAL_SHOT_OUT || 'portal-shot-evidence' });
  } finally { await browser.close(); }
}
