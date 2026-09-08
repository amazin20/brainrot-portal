import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

/** Production WebGL evidence for the September 8 video regressions.
 *
 * The rapid-fire section uses only trusted mouse events and the normal clock.
 * Its observers preserve the original methods and return values. The room
 * section uses the existing ordinary-control route with its fixed simulation
 * clock; captured images retain the game's normal third-person camera. The complete bridge movement is sampled every fifth 60Hz simulation frame (12Hz) without interpolation. Neither
 * section assigns an actor, cargo, portal, mechanism, or camera transform.
 * Run this as a project CI test, with the built production preview running.
 */
export async function runSep8Browser({ browser, baseUrl = 'http://127.0.0.1:4173/',
  out = 'sep8-evidence', mode = 'all' } = {}) {
  assert.ok(browser, 'Use the existing CI browser harness');
  assert.ok(['all', 'burst', 'rooms'].includes(mode));
  fs.mkdirSync(out, { recursive: true });
  const report = { pass: false, baseUrl, mode, errors: [], networkFailures: [], rooms: [],
    renderer: 'Production WebGL / CI Chromium SwiftShader',
    limits: 'Mouse burst uses real input and normal render timing. Room clips sample ordinary routes at 60Hz; the full bridge movement uses every fifth step (12Hz). These are simulation samples, not measured real-time gameplay FPS. No free camera or moved gameplay fixtures.' };
  const started = Date.now();
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  await page.setViewport({ width: 960, height: 600, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('response', response => {
    if (response.status() >= 400) report.networkFailures.push({ url: response.url(), status: response.status() });
  });
  const saveImage = (file, data) => fs.writeFileSync(path.join(out, file), Buffer.from(data.split(',')[1], 'base64'));
  const snapshot = () => page.evaluate(() => {
    const g = window.__NESI_DEMO_GAME__, s = g.portalShots;
    return { level: g.levelIndex + 1, state: g.state, player: g.playerPosition.toArray(),
      authoredSpawn: [...g.firstLevel.spawn], serial: [...s.serial], time: s.time,
      queued: s.queue.map(q => q.sequence), flying: s.active.map(q => q.sequence),
      impact: s.lastImpact, surfaceIds: [...g.portalSurfaceIds],
      portals: g.portals.portals.map(p => p ? { position: p.position.toArray(), normal: p.normal.toArray() } : null),
      camera: { position: g.camera.position.toArray(), quaternion: g.camera.quaternion.toArray() },
      locked: document.pointerLockElement === g.renderer.domElement };
  });
  async function openRoom(room) {
    const url = new URL(baseUrl);
    url.searchParams.set('debug', '1'); url.searchParams.set('level', String(room));
    await page.goto(url.href, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => window.__NESI_DEMO_GAME__?.state === 'ready');
    await page.click('#play-button');
    await page.waitForFunction(() => window.__NESI_DEMO_GAME__?.state === 'playing' && window.__NESI_DEMO_GAME__.renderFrames > 2);
    const initial = await snapshot();
    assert.equal(initial.level, room);
    assert.deepEqual(initial.player, initial.authoredSpawn, 'Start at the actual authored spawn');
    return initial;
  }
  let mouse = { x: 480, y: 300 };
  async function aimAt(target) {
    const attempts = [];
    for (let n = 0; n < 36; n++) {
      await page.waitForFunction(() => {
        const g = window.__NESI_DEMO_GAME__;
        return g.state === 'playing' && !g.externalBlocked &&
          Math.abs(Math.atan2(Math.sin(g.yaw - g.cameraRig.yaw), Math.cos(g.yaw - g.cameraRig.yaw))) < .003 &&
          Math.abs(g.pitch - g.cameraRig.pitch) < .003;
      });
      const error = await page.evaluate(target => {
        const g = window.__NESI_DEMO_GAME__;
        const v = g.playerPosition.clone().fromArray(target).sub(g.camera.position).applyQuaternion(g.camera.quaternion.clone().invert());
        return { horizontal: Math.atan2(v.x, -v.z), vertical: Math.atan2(v.y, Math.hypot(v.x, v.z)),
          ndc: g.playerPosition.clone().fromArray(target).project(g.camera).toArray(), frame: g.renderFrames };
      }, target);
      attempts.push(error);
      if (Math.abs(error.horizontal) < .006 && Math.abs(error.vertical) < .006 && error.ndc[2] < 1) return attempts;
      mouse.x += Math.round(Math.max(-220, Math.min(220, error.horizontal * .82 / .002)));
      mouse.y += Math.round(Math.max(-150, Math.min(150, -error.vertical * .82 / .0018)));
      await page.mouse.move(mouse.x, mouse.y);
      await page.waitForFunction(frame => window.__NESI_DEMO_GAME__.renderFrames >= frame + 2, {}, error.frame);
    }
    throw Error(`Trusted mouse aim failed: ${JSON.stringify(attempts.at(-1))}`);
  }
  let probeActive = false;
  async function finishBurstEvidence() {
    if (!probeActive) return;
    probeActive = false;
    const evidence = await page.evaluate(() => window.__NESI_SEP8_PROBE__.finish());
    if (evidence.video) {
      const bytes = Buffer.from(evidence.video.split(',')[1], 'base64');
      fs.writeFileSync(path.join(out, 'trusted-burst.webm'), bytes);
      report.burst.recording = { file: 'trusted-burst.webm', bytes: bytes.length,
        requestedFps: 60, mimeType: evidence.mimeType, trackSettings: evidence.trackSettings };
      delete evidence.video;
    }
    const times = evidence.frames.map(f => f.wallTime);
    const duration = times.length > 1 ? times.at(-1) - times[0] : 0;
    report.burst.renderTiming = { sampledFrames: times.length, durationMs: duration,
      observedFps: duration ? (times.length - 1) * 1000 / duration : null };
    report.burst.evidence = evidence;
  }
  try {
    if (mode !== 'rooms') {
      const initial = await openRoom(9);
      if (!initial.locked) {
        await page.mouse.click(mouse.x, mouse.y);
        await page.waitForFunction(() => !!document.pointerLockElement);
        assert.deepEqual((await snapshot()).serial, initial.serial, 'The first unlocked click only acquires the pointer');
      }
      await page.mouse.move(mouse.x, mouse.y);
      const target = await page.evaluate(() => {
        const g = window.__NESI_DEMO_GAME__;
        // Keep the test on a real broad white wall. Its far interior provides
        // enough travel for a second legal click while the prior charge flies.
        const candidates = ['work-front', 'work-left', 'work-right'].flatMap(name => {
          const panel = g.firstLevel.panels[name], f = panel.getFrame();
          return [-1, 1].map(sign => {
            const point = f.center.clone().addScaledVector(f.right, sign * Math.max(0, f.halfWidth - 2));
            point.y -= .2;
            return { name, point, surface: panel.mesh.userData.portalColliderId ?? panel.mesh.uuid };
          });
        });
        candidates.sort((a, b) => b.point.distanceToSquared(g.playerPosition) - a.point.distanceToSquared(g.playerPosition));
        const chosen = candidates[0];
        return { panel: chosen.name, point: chosen.point.toArray(), distance: chosen.point.distanceTo(g.playerPosition), surface: chosen.surface };
      });
      report.burst = { initial, target, aim: await aimAt(target.point) };
      assert.ok(target.distance > 12, 'The authored view must provide enough projectile travel for an overlapping burst');
      await page.screenshot({ path: path.join(out, 'burst-before.png') });
      await page.evaluate(() => {
        const g = window.__NESI_DEMO_GAME__, s = g.portalShots, canvas = g.renderer.domElement;
        const original = { request: s.request, launch: s.launch, impact: s.impact }, trace = [], events = [], frames = [];
        const portals = () => g.portals.portals.map(p => p ? { position: p.position.toArray(), normal: p.normal.toArray() } : null);
        const record = item => trace.push({ ...item, wallTime: performance.now(), simulationTime: s.time });
        const dom = event => events.push({ type: event.type, trusted: event.isTrusted, button: event.button,
          locked: document.pointerLockElement === canvas, target: event.target === canvas ? 'canvas' : event.target?.id,
          wallTime: performance.now(), simulationTime: s.time });
        for (const name of ['pointerdown', 'pointerup']) document.addEventListener(name, dom, true);
        s.request = function (index) {
          const before = portals(), olderFlying = this.active.map(a => ({ index: a.index, sequence: a.sequence }));
          const accepted = original.request.call(this, index);
          record({ kind: 'request', index, accepted, sequence: this.serial[index], olderFlying,
            before, after: portals(), rejection: accepted ? null : this.lastRequest?.reason });
          return accepted;
        };
        s.launch = function (shot) {
          const value = original.launch.call(this, shot);
          const live = this.active.find(a => a.index === shot.index && a.sequence === shot.sequence);
          record({ kind: 'launch', index: shot.index, sequence: shot.sequence, launched: !!live,
            origin: live?.position.toArray(), target: shot.point.toArray(), before: portals() });
          return value;
        };
        s.impact = function (shot, hit) {
          const value = original.impact.call(this, shot, hit);
          record({ kind: 'impact', index: shot.index, sequence: shot.sequence, latestRequest: this.serial[shot.index],
            result: { ...this.lastImpact }, travel: shot.travel, after: portals() });
          return value;
        };
        let running = true, frameId, previous = -1;
        const frame = () => {
          if (!running) return;
          if (g.renderFrames !== previous) {
            previous = g.renderFrames;
            frames.push({ wallTime: performance.now(), simulationTime: s.time, frame: g.renderFrames,
              flying: s.active.map(a => ({ sequence: a.sequence, position: a.position.toArray() })),
              impact: s.lastImpact, portals: portals() });
          }
          frameId = requestAnimationFrame(frame);
        };
        frameId = requestAnimationFrame(frame);
        const chunks = [];
        let recorder, stream, mimeType, unavailable, trackSettings;
        try {
          mimeType = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
          if (!mimeType) throw Error('No supported WebM encoder');
          stream = canvas.captureStream(60); trackSettings = stream.getVideoTracks()[0].getSettings();
          recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3500000 });
          recorder.addEventListener('dataavailable', e => { if (e.data.size) chunks.push(e.data); }); recorder.start(250);
        } catch (error) { unavailable = String(error); }
        window.__NESI_SEP8_PROBE__ = { trace, async finish() {
          running = false; cancelAnimationFrame(frameId);
          let video;
          if (recorder && recorder.state !== 'inactive') {
            await new Promise(resolve => { recorder.addEventListener('stop', resolve, { once: true }); recorder.stop(); });
            video = await new Promise((resolve, reject) => {
              const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject;
              reader.readAsDataURL(new Blob(chunks, { type: mimeType }));
            });
          }
          stream?.getTracks().forEach(t => t.stop());
          for (const name of ['pointerdown', 'pointerup']) document.removeEventListener(name, dom, true);
          for (const name of ['request', 'launch', 'impact']) s[name] = original[name];
          return { trace, events, frames, video, mimeType, unavailable, trackSettings };
        } };
      });
      probeActive = true;
      for (let n = 0; n < 5; n++) {
        // Poll the normal clock. No time stepping or actor writes. Do not wait
        // for active charges: that would conceal the user's rapid-fire bug.
        await page.waitForFunction(() => {
          const s = window.__NESI_DEMO_GAME__.portalShots;
          return s.cooldown === 0 && s.queue.length === 0;
        }, { polling: 20 });
        await page.mouse.down({ button: 'left' }); await page.mouse.up({ button: 'left' });
      }
      await page.waitForFunction(() => {
        const s = window.__NESI_DEMO_GAME__.portalShots;
        return s.queue.length === 0 && s.active.length === 0;
      });
      report.burst.final = await snapshot();
      await page.screenshot({ path: path.join(out, 'burst-after.png') });
      await finishBurstEvidence();
      const { trace, events } = report.burst.evidence;
      const requests = trace.filter(t => t.kind === 'request' && t.accepted);
      const impacts = trace.filter(t => t.kind === 'impact');
      const overlaps = requests.filter(t => t.olderFlying.some(a => a.index === 0 && a.sequence < t.sequence));
      const placementsDuringLaterFlight = impacts.filter(t => t.result.valid && t.latestRequest > t.sequence);
      report.burst.proof = { accepted: requests.length, overlappingRequests: overlaps.length,
        placedAfterNewerRequest: placementsDuringLaterFlight.length, validImpacts: impacts.filter(t => t.result.valid).length };
      assert.equal(requests.length, 5);
      assert.deepEqual(requests.map(t => t.sequence), [1, 2, 3, 4, 5], 'Five trusted clicks must accept exactly five new shots');
      assert.ok(overlaps.length >= 3, `At least three clicks must overlap their predecessors: ${JSON.stringify(report.burst.proof)}`);
      assert.ok(placementsDuringLaterFlight.length >= 1, 'Earlier charges must place after a newer same-colour click');
      assert.equal(impacts.length, 5, 'All five accepted charges must reach a terminal impact');
      assert.ok(impacts.every(t => t.result.valid), 'A burst aimed at unobstructed white ceramic must not starve portal placement');
      assert.ok(impacts.some(t => t.result.valid && t.simulationTime < requests.at(-1).simulationTime), 'A portal must appear before the burst ends');
      assert.ok(requests.every(t => JSON.stringify(t.before) === JSON.stringify(t.after)), 'Requesting a shot must not place instantly');
      assert.equal(report.burst.final.surfaceIds[0], target.surface);
      assert.deepEqual(report.burst.final.player, initial.player, 'Stationary burst must not move the player');
      const clicks = events.filter(e => e.type === 'pointerdown');
      assert.equal(clicks.length, 5);
      assert.ok(clicks.every(e => e.trusted && e.locked && e.target === 'canvas' && e.button === 0));
      console.log('September 8 trusted burst passed', JSON.stringify(report.burst.proof));
    }
    if (mode !== 'burst') for (const room of [7, 9, 10]) {
      const initial = await openRoom(room);
      await page.screenshot({ path: path.join(out, `room-${room}-start.png`) });
      const captured = await page.evaluate(async room => {
        const g = window.__NESI_DEMO_GAME__, original = { render: g.render, updateVisuals: g.updateVisuals };
        const stills = [], frames = [], timeline = [];
        let ticks = 0, capturing = false, captureStart = 0;
        const sampleEvery = room === 10 ? 5 : 1, sampleCount = room === 10 ? 60 : 24;
        const state = () => ({ simulationFrame: ticks, player: g.playerPosition.toArray(), cargo: g.cargo.position.toArray(),
          camera: { position: g.camera.position.toArray(), quaternion: g.camera.quaternion.toArray() },
          mechanism: room === 7 ? { angle: g.firstLevel.state.angle, counter: g.firstLevel.state.counterIndex }
            : room === 9 ? { compression: g.firstLevel.state.piston.compression, latched: g.firstLevel.state.piston.latched }
              : { progress: g.firstLevel.state.freight.progress, loaded: g.firstLevel.state.freight.loaded() } });
        g.render = function (...args) {
          const result = original.render.apply(this, args);
          if (this.state === 'playing') stills.push({ ...state(), image: this.renderer.domElement.toDataURL('image/png') });
          return result;
        };
        g.updateVisuals = function (...args) {
          const result = original.updateVisuals.apply(this, args); ticks++;
          const s = this.firstLevel.state;
          const active = room === 7 ? s.counterIndex === 2 && Math.abs(s.omega) > .01
            : room === 9 ? !this.heldCube && this.cargo.position.y < 4 && this.cargo.position.y > 2.5 && this.cargo.position.z < -2 && this.physics.cargoBody.velocity.y < -1
              : s.freight.progress > .10 && s.freight.progress < .90;
          if (!capturing && active) { capturing = true; captureStart = ticks; }
          if (capturing && (ticks - captureStart) % sampleEvery === 0 && frames.length < sampleCount) {
            original.render.call(this);
            frames.push(this.renderer.domElement.toDataURL('image/png')); timeline.push(state());
          }
          return result;
        };
        try { return { route: await window.__NESI_RUN_LEVEL_ROUTE__(), stills, frames, timeline }; }
        finally { g.render = original.render; g.updateVisuals = original.updateVisuals; }
      }, room);
      const item = { room, initial, route: captured.route, sampledSimulationFps: room === 10 ? 12 : 60,
        sampledFrames: captured.frames.length, timeline: captured.timeline,
        stills: captured.stills.map(({ image, ...state }, i) => ({ file: `room-${room}-milestone-${i + 1}.png`, ...state })) };
      report.rooms.push(item);
      captured.stills.forEach((s, i) => saveImage(`room-${room}-milestone-${i + 1}.png`, s.image));
      const frameDir = `room-${room}-frames`; fs.mkdirSync(path.join(out, frameDir), { recursive: true });
      captured.frames.forEach((data, i) => saveImage(`${frameDir}/${String(i).padStart(3, '0')}.png`, data));
      if (room === 9) {
        const checkpoint = captured.route.milestones.find(m => m.name === 'inspected spring linkage and guard slot');
        assert.ok(checkpoint, 'The ordinary route must inspect the accessible side of the spring before pickup');
        const close = captured.stills.find(s => s.player.every((v, i) => Math.abs(v - checkpoint.player[i]) < 1e-8));
        assert.ok(close, 'The near spring checkpoint must have an actual normal-camera render');
        assert.equal(close.mechanism.latched, true);
        assert.ok(Math.hypot(close.player[0] + 2, close.player[2] + 5) < 7, 'Close inspection must walk near the real linkage');
        saveImage('room-9-linkage-close.png', close.image);
        const { image, ...view } = close;
        item.closeInspection = { file: 'room-9-linkage-close.png', checkpoint: checkpoint.name, ...view };
      }
      await page.screenshot({ path: path.join(out, `room-${room}-complete.png`) });
      assert.ok(captured.route.pass && captured.route.resets === 0 && captured.route.respawns === 0, `Room ${room} ordinary route must pass`);
      assert.equal(captured.frames.length, room === 10 ? 60 : 24, `Room ${room} must expose real mechanism motion`);
      assert.ok(captured.stills.length >= 1);
      console.log(`September 8 room ${room} ordinary route and normal-camera evidence passed`, captured.route.frames);
      if (room === 7) {
        const negative = await page.evaluate(async () => {
          const g = window.__NESI_DEMO_GAME__, update = g.updateVisuals, images = [], timeline = [];
          let capturing = false, ticks = 0;
          g.updateVisuals = function (...args) {
            const result = update.apply(this, args); ticks++;
            if (this.heldCube && !this.playerGrounded && this.playerPosition.z < .9) capturing = true;
            if (capturing && images.length < 18) {
              this.render(); images.push(this.renderer.domElement.toDataURL('image/png'));
              timeline.push({ simulationFrame: ticks, player: this.playerPosition.toArray(),
                cargo: this.cargo.position.toArray(), cargoHeld: this.heldCube === this.cargo,
                angle: this.firstLevel.state.angle, grounded: this.playerGrounded,
                camera: { position: this.camera.position.toArray(), quaternion: this.camera.quaternion.toArray() } });
            }
            return result;
          };
          try {
            if (typeof window.__NESI_RUN_BALANCE_BYPASS__ !== 'function') throw Error('The debug ordinary-control balance attempt is missing');
            return { ...await window.__NESI_RUN_BALANCE_BYPASS__(), images, timeline };
          } finally { g.updateVisuals = update; }
        });
        const frameDir = 'room-7-bypass-frames'; fs.mkdirSync(path.join(out, frameDir), { recursive: true });
        negative.images.forEach((data, i) => saveImage(`${frameDir}/${String(i).padStart(3, '0')}.png`, data));
        const { images, ...data } = negative;
        report.balanceBypass = { ...data, consecutiveFrames: images.length, sampledSimulationFps: 60 };
        await page.screenshot({ path: path.join(out, 'room-7-bypass-blocked.png') });
        assert.equal(negative.attempt.reached, false, 'Carry jumping must not reach the high gallery');
        assert.equal(negative.attempt.cargoHeld, true, 'The correction must retain the carried friend');
        assert.equal(negative.attempt.teleports, 0);
        assert.equal(negative.route.resets + negative.route.respawns, 0);
        assert.equal(negative.images.length, 18);
        console.log('September 8 ordinary carry-jump bypass rejected', JSON.stringify(negative.attempt));
      }
    }
    const optional = new Set(['/favicon.ico', '/.well-known/appspecific/com.chrome.devtools.json']);
    report.optionalRequests = report.networkFailures.filter(r => r.status === 404 && optional.has(new URL(r.url).pathname));
    assert.deepEqual(report.networkFailures.filter(r => !report.optionalRequests.includes(r)), []);
    assert.deepEqual(report.errors, []);
    report.pass = true;
    return report;
  } catch (error) {
    report.error = String(error);
    report.failureState = await snapshot().catch(() => null);
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    await finishBurstEvidence().catch(error => { report.evidenceError = String(error); });
    report.wallDurationMs = Date.now() - started;
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
    await runSep8Browser({ browser, baseUrl: process.env.SEP8_URL || 'http://127.0.0.1:4173/',
      out: process.env.SEP8_OUT || 'sep8-evidence', mode: process.env.SEP8_MODE || 'all' });
  } finally { await browser.close(); }
}
