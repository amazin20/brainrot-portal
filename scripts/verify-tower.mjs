/** Verify the rebuilt Tower through the production browser route.
 * The observer measures the simulation itself, independently of route reports.
 * Import runTowerVerification from the recorder to capture that same run.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {TOWER_STAGES} from '../src/game/LabTowerLayout.js';
import {towerCourse} from '../src/game/LabTowerCourses.js';
import {KEYSTONE_SPECS} from '../src/game/LabTowerKeystones.js';

export const TOWER_CAPTURE = Object.freeze({level: 41, stages: 18, decks: 6, branchesPerDeck: 3, keystones: 6, width: 854, height: 480, visualHz: 60, physicsHz: 120, stride: 5, fps: 12});
export const TOWER_COURSE_TYPES=Object.freeze(Object.fromEntries(TOWER_STAGES.map(stage=>[stage.id,towerCourse(stage).topology])));
const COURSE_SHORT=Object.freeze({'enclosed-annex':'annex','forked-island':'island',
 'raised-causeway':'terrace','broken-skybridge':'skybridge','accumulator-maze':'maze',
 'momentum-shaft':'shaft'});
export const TOWER_COURSE_EXPECTED=Object.freeze(Object.fromEntries(
 Object.keys(COURSE_SHORT).map(type=>[COURSE_SHORT[type],TOWER_STAGES.filter(stage=>TOWER_COURSE_TYPES[stage.id]===type).map(stage=>stage.id)])));

export function validateTowerEvidence(evidence) {
  const {route, observed} = evidence;
  assert.equal(route.pass, true, 'The ordinary route must reach the actual Tower goal');
  assert.equal(route.level, TOWER_CAPTURE.level);
  assert.equal(route.resets, 0, 'No in-route companion resets');
  assert.equal(route.respawns, 0, 'No in-route player respawns');
  assert.equal(route.stagesCompleted, TOWER_CAPTURE.stages);
  assert.equal(observed.last.state, 'won');
  assert.equal(observed.first.completedStages, 0);
  assert.equal(observed.last.completedStages, TOWER_CAPTURE.stages);
  assert.equal(observed.stageEvents.length, TOWER_CAPTURE.stages);
  assert.equal(observed.keystoneEvents.length, TOWER_CAPTURE.keystones);
  for (const [topology, expected] of Object.entries(TOWER_COURSE_EXPECTED))
    assert.deepEqual(new Set(observed.courseVisits?.[topology]),new Set(expected),
      `The route must physically traverse every ${topology} space`);
  const fling = route.flings?.find(event => event.stageId === 'exchange');
  assert.ok(route.flings?.length === 1 && fling?.speed > 11.5
    && fling.landing?.[1] > 2 && fling.landing?.[1] < 2.1,
    'The Exchange crossing must retain fall momentum and land on its raised shelf');
  assert.equal(observed.resetCalls, 0);
  assert.equal(observed.respawnCalls, 0);
  assert.equal(observed.cargoResetCalls, 0);
  assert.ok(observed.simulatedSeconds >= 900, `Complete Tower route must take at least 15 simulation minutes, got ${observed.simulatedSeconds}s`);
  assert.ok(observed.activeSeconds >= 900, `At least 15 minutes must contain real movement or aim input, got ${observed.activeSeconds}s`);
  assert.ok(observed.movingSeconds > 0, 'The route must traverse the actual Tower');
  assert.ok(route.activeInputSeconds >= 900, 'The ordinary input route must contain at least 15 minutes of movement, aiming or puzzle actions');
  assert.ok(route.maxIdleSeconds <= 5 && route.maxNoInputSeconds <= 5, 'The route must have no AFK segment');
  assert.ok(observed.maxIdleSeconds <= 5, `Idle gap exceeded five seconds: ${observed.maxIdleSeconds}s`);
  assert.ok(observed.distanceMeters > TOWER_CAPTURE.stages * 5, 'The full journey must cover real physical distance');
  assert.ok(observed.teleports > 0, 'A portal-focused Tower route must physically traverse portals');
  assert.equal(route.teleports, observed.teleports, 'Route and independent observer disagree on portal transfers');
  assert.ok(route.shots > 0 && route.interactions > 1, 'The route must use the portal gun and manipulate puzzle mechanisms');
  assert.ok(Math.abs(observed.physicsSeconds - observed.simulatedSeconds) <= 1 / 60 + 1e-6, 'Physics and visual simulation clocks diverged');
  assert.equal(observed.physicsSteps, route.physicsSteps);
  assert.ok(Math.abs(observed.simulatedSeconds - route.simulatedSeconds) < .02, 'Reported duration disagrees with observed simulation');
  assert.ok(Math.abs(observed.distanceMeters - route.distanceTravelled) < .02, 'Reported distance disagrees with observed 120 Hz movement');
  let previousFrame = -1;
  const branchKeys = new Set(), solvedIds = new Set();
  const authoredById = new Map(TOWER_STAGES.map(stage => [stage.id, stage]));
  for (const [index, event] of observed.stageEvents.entries()) {
    assert.equal(event.stage, index + 1, 'Each puzzle completion must be counted once in chronological order');
    assert.ok(typeof event.id === 'string' && event.id.length > 0, 'Each puzzle wing needs a stable id');
    assert.ok(Number.isInteger(event.deck) && event.deck >= 0 && event.deck < TOWER_CAPTURE.decks, 'Invalid puzzle deck');
    assert.ok(Number.isInteger(event.branch) && event.branch >= 0 && event.branch < TOWER_CAPTURE.branchesPerDeck, 'Invalid puzzle branch');
    assert.ok(!solvedIds.has(event.id), 'A puzzle wing was counted more than once');
    solvedIds.add(event.id);
    branchKeys.add(`${event.deck}:${event.branch}`);
    assert.ok(event.frame > previousFrame, 'Stage completion frames must increase');
    assert.ok(event.simulatedSeconds > 0 && event.simulatedSeconds <= observed.simulatedSeconds + 1e-6);
    previousFrame = event.frame;
  }
  assert.equal(branchKeys.size, TOWER_CAPTURE.stages, 'The complete route must solve all three distinct branches on every deck');
  assert.deepEqual(solvedIds, new Set(TOWER_STAGES.map(stage => stage.id)), 'The route must solve the exact eighteen authored puzzles');
  for (const event of observed.stageEvents) {
    const authored = authoredById.get(event.id);
    assert.ok(authored && authored.deck === event.deck && authored.branch === event.branch, 'Puzzle identity must match its authored deck and branch');
  }
  assert.equal(route.stageEvents.length, TOWER_CAPTURE.stages);
  assert.deepEqual(route.stageEvents.map(event => event.stage), observed.stageEvents.map(event => event.stage));
  assert.deepEqual(route.stageEvents.map(event => event.id), observed.stageEvents.map(event => event.id));
  assert.equal(evidence.gameMetrics.completedStages, TOWER_CAPTURE.stages);
  assert.equal(evidence.gameMetrics.totalStages, TOWER_CAPTURE.stages);
  assert.equal(evidence.gameMetrics.checkpoints, false);
  assert.deepEqual(evidence.gameMetrics.solvedIds, observed.stageEvents.map(event => event.id));
  assert.deepEqual(evidence.gameMetrics.deckRelays, [true,true,true,true,true,true]);
  assert.equal(evidence.gameMetrics.relayEvents.length, TOWER_CAPTURE.decks);
  assert.deepEqual(new Set(evidence.gameMetrics.relayEvents.map(event => event.deck)), new Set([0,1,2,3,4,5]));
  assert.deepEqual(evidence.gameMetrics.keystoneSolved, [true,true,true,true,true,true]);
  assert.equal(evidence.gameMetrics.keystoneEvents.length, TOWER_CAPTURE.keystones);
  assert.equal(route.keystoneEvents.length, TOWER_CAPTURE.keystones);
  const keystoneIds = new Set(), keystoneDecks = new Set();
  for (const event of observed.keystoneEvents) {
    assert.ok(typeof event.id === 'string' && event.id.length > 0 && !keystoneIds.has(event.id), 'Each keystone must have a unique identity');
    assert.ok(Number.isInteger(event.deck) && event.deck >= 0 && event.deck < TOWER_CAPTURE.decks && !keystoneDecks.has(event.deck), 'Each deck needs its own keystone completion');
    assert.equal(event.id, KEYSTONE_SPECS[event.deck].id, 'Keystone identity must match the authored machine for this deck');
    keystoneIds.add(event.id); keystoneDecks.add(event.deck);
    const wings = observed.stageEvents.filter(wing => wing.deck === event.deck);
    const relay = evidence.gameMetrics.relayEvents.find(item => item.deck === event.deck);
    assert.equal(wings.length, TOWER_CAPTURE.branchesPerDeck);
    assert.ok(relay && event.simulatedSeconds > relay.seconds && event.simulatedSeconds > Math.max(...wings.map(wing => wing.simulatedSeconds)), 'Keystone must follow the three live wings and their relay');
  }
  assert.deepEqual([...keystoneDecks].sort(), [0,1,2,3,4,5]);
  assert.deepEqual(route.keystoneEvents.map(event => [event.deck,event.id]), observed.keystoneEvents.map(event => [event.deck,event.id]));
  assert.deepEqual(evidence.gameMetrics.keystoneEvents.map(event => [event.deck,event.id]), observed.keystoneEvents.map(event => [event.deck,event.id]));
  assert.deepEqual(evidence.gameMetrics.stageEvents.map(event => event.id), observed.stageEvents.map(event => event.id));
  assert.equal(evidence.gameMetrics.teleports, observed.teleports);
  assert.deepEqual(evidence.errors, []);
}

export async function runTowerVerification({out = process.env.OUT_DIR || 'qa/tower-verification', record = false, writeBatch = null} = {}) {
  const {default: puppeteer} = await import('puppeteer-core');
  out = path.resolve(out);
  fs.mkdirSync(out, {recursive: true});
  const errors = [];
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    headless: true,
    // Recording 15+ simulation minutes using software WebGL can take hours.
    protocolTimeout: record ? 18_000_000 : 1_800_000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  let page;
  try {
    page = await browser.newPage();
    page.setDefaultTimeout(180_000);
    await page.setViewport({width: TOWER_CAPTURE.width, height: TOWER_CAPTURE.height, deviceScaleFactor: 1});
    page.on('pageerror', error => errors.push(String(error)));
    let lastProgress = -1;
    await page.exposeFunction('__NESI_TOWER_WRITE_BATCH__', async batch => {
      if (writeBatch) await writeBatch(batch);
    });
    await page.exposeFunction('__NESI_TOWER_PROGRESS__', snapshot => {
      const stage = snapshot.completedStages;
      if (stage >= lastProgress + 3 || stage === TOWER_CAPTURE.stages || lastProgress === -1) {
        console.log(`Tower ${stage}/${TOWER_CAPTURE.stages}; simulation ${snapshot.simulatedSeconds.toFixed(1)}s; distance ${snapshot.distanceMeters.toFixed(1)}m; ${snapshot.encodedFrames} captured frames`);
        lastProgress = stage;
      }
    });
    await page.exposeFunction('__NESI_TOWER_SAVE_STILL__', (name, data) => {
      assert.ok(['start', 'middle', 'finish'].includes(name) ||
        /^course-(annex|island|terrace|skybridge|maze|shaft)$/.test(name));
      assert.match(data, /^data:image\/jpeg;base64,/);
      fs.writeFileSync(path.join(out, `tower-${name}.jpg`), Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
    });
    const url = new URL(process.env.PAGE_URL || 'http://127.0.0.1:4173/');
    url.searchParams.set('edition', 'foundation');
    url.searchParams.set('level', String(TOWER_CAPTURE.level));
    url.searchParams.set('debug', '1');
    await page.goto(url.href, {waitUntil: 'networkidle2'});
    await page.waitForFunction(() => window.__NESI_DEMO_GAME__?.state === 'ready');
    const info = await page.evaluate(async () => {
      const response = await fetch('build-info.json', {cache: 'no-store'});
      if (!response.ok) throw Error(`Build metadata HTTP ${response.status}`);
      return response.json();
    });
    assert.equal(info.levels, 41);
    assert.equal(info.version, 'v44-tower-variety');
    assert.equal(info.features.defaultEdition, 'foundation');
    if (process.env.BUILD_COMMIT) assert.equal(info.commit, process.env.BUILD_COMMIT);
    assert.equal(await page.$eval('#level-select', element => Number(element.value)), 40);
    const menu = await page.$$eval('#level-select option', options => options.map(option => Number(option.value)));
    assert.deepEqual(menu, Array.from({length: 41}, (_, index) => index));
    const title = await page.$eval('#level-select option[value="40"]', element => element.textContent.trim());
    await page.screenshot({path: path.join(out, 'tower-menu.png')});
    await page.waitForFunction(() => {
      const menu = document.querySelector('#start-screen');
      return menu && !menu.inert && getComputedStyle(menu).opacity === '1';
    });
    const graphicsBenchmark = [];
    if (record) {
      // Use the game's ordinary graphics control. Benchmark before Play, with
      // no physics updates, to measure the software renderer plus JPEG readback.
      await page.evaluate(() => {
        const game = window.__NESI_DEMO_GAME__;
        if (game.state !== 'ready') throw Error('Graphics benchmark must precede gameplay');
        game.renderer.setAnimationLoop(null);
      });
      try {
        for (const preset of ['balanced', 'low']) {
          await page.select('#quality-select', preset);
          graphicsBenchmark.push(await page.evaluate(preset => {
            const game = window.__NESI_DEMO_GAME__;
            const initial = {elapsed: game.elapsed, stages: game.firstLevel.completedStages, player: game.playerPosition.toArray()};
            if (game.state !== 'ready') throw Error('Benchmark cannot advance a started run');
            const canvas = document.createElement('canvas');
            canvas.width = game.renderer.domElement.width; canvas.height = game.renderer.domElement.height;
            const context = canvas.getContext('2d', {alpha: false});
            const capture = () => {
              game.render(); context.drawImage(game.renderer.domElement, 0, 0);
              canvas.toDataURL('image/jpeg', .84);
            };
            capture(); // Warm the newly selected shader variant before timing.
            const samples = [];
            for (let frame = 0; frame < 12; frame++) {
              const started = performance.now(); capture(); samples.push(performance.now() - started);
            }
            const after = {elapsed: game.elapsed, stages: game.firstLevel.completedStages, player: game.playerPosition.toArray()};
            if (game.state !== 'ready' || JSON.stringify(initial) !== JSON.stringify(after)) throw Error('Graphics benchmark changed gameplay state');
            samples.sort((a, b) => a - b);
            return {preset, width: canvas.width, height: canvas.height, frames: 12, warmupFrames: 1,
              shadows: game.renderer.shadowMap.enabled, medianFrameMs: (samples[5] + samples[6]) / 2,
              meanFrameMs: samples.reduce((sum, ms) => sum + ms, 0) / samples.length};
          }, preset));
        }
      } finally {
        await page.evaluate(() => window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(window.__NESI_DEMO_GAME__.animate));
      }
      for (const result of graphicsBenchmark) {
        assert.equal(result.width, TOWER_CAPTURE.width); assert.equal(result.height, TOWER_CAPTURE.height);
      }
      assert.equal(graphicsBenchmark[1].shadows, false, 'The normal low graphics preset must disable shadows');
      console.log('TOWER GRAPHICS BENCHMARK', JSON.stringify({results: graphicsBenchmark,
        medianSpeedup: graphicsBenchmark[0].medianFrameMs / graphicsBenchmark[1].medianFrameMs, selected: 'low'}));
    }
    const graphicsPreset = await page.$eval('#quality-select', element => element.value);
    if (record) assert.equal(graphicsPreset, 'low');
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await page.evaluate(() => window.__NESI_DEMO_GAME__.state !== 'ready')) break;
      await page.bringToFront();
      await page.focus('#play-button');
      await page.click('#play-button');
      await page.waitForFunction(() => window.__NESI_DEMO_GAME__.state !== 'ready', {timeout: 12_000}).catch(error => {
        if (error.name !== 'TimeoutError') throw error;
      });
    }
    await page.waitForFunction(() => window.__NESI_DEMO_GAME__.state === 'playing');
    const result = await page.evaluate(async ({record, settings}) => {
      const game = window.__NESI_DEMO_GAME__;
      game.renderer.setAnimationLoop(null);
      const level = game.firstLevel;
      const check = (condition, message) => { if (!condition) throw Error(message); };
      check(game.chamberEdition === 'foundation' && game.levelIndex === 40, 'Wrong campaign or room');
      check(level.towerChallenge === true && level.totalStages === settings.stages && level.completedStages === 0, 'Tower must begin before the first puzzle wing');
      const originals = {visual: game.updateVisuals, physics: game.updatePlaying, reset: game.resetRun, respawn: game.respawn, cargoReset: game.physics.resetCargo, flush: window.__NESI_TOWER_FLUSH_FRAMES__};
      const bodyId = game.physics.cargoBody.id, initialTeleports = game.teleportCount;
      const observed = {first: null, last: null, frames: 0, physicsSteps: 0, physicsSeconds: 0, simulatedSeconds: 0, distanceMeters: 0,
        activeSeconds: 0, movingSeconds: 0, maxIdleSeconds: 0, maxStationarySeconds: 0, resetCalls: 0, respawnCalls: 0, cargoResetCalls: 0, teleports: 0, stageEvents: [], keystoneEvents: [], telemetry: [],
        courseVisits: Object.fromEntries(Object.values(settings.courseTypes).map(type=>[type,[]]))};
      let previousVisualPosition = game.playerPosition.clone(), previousYaw = game.yaw, previousPitch = game.pitch;
      const courseSeen = Object.fromEntries(Object.values(settings.courseTypes).map(type=>[type,new Set()]));
      const courseStillSaved = new Set();
      let previousStage = 0, previousKeystone = 0, idleSeconds = 0, stationarySeconds = 0, batch = [], encodedFrames = 0;
      let middleSaved = false, maxQueuedFrames = 0, lastCapture = null;
      const composed = document.createElement('canvas');
      composed.width = settings.width; composed.height = settings.height;
      const context = composed.getContext('2d', {alpha: false});
      const state = () => ({visualFrame: observed.frames, level: game.levelIndex + 1, state: game.state,
        completedStages: level.completedStages, simulatedSeconds: observed.simulatedSeconds,
        cargoBodyId: game.physics.cargoBody.id, player: game.playerPosition.toArray(), cargo: game.cargo.position.toArray()});
      // The WebGL canvas excludes HTML HUD. Compose a small, truthful overlay
      // from this exact simulation frame; the 3D view is never reframed.
      const jpeg = () => {
        context.drawImage(game.renderer.domElement, 0, 0);
        context.fillStyle = 'rgba(8, 17, 23, .88)'; context.fillRect(14, 14, 266, 66);
        context.fillStyle = '#91e8e1'; context.font = 'bold 12px sans-serif'; context.fillText('БАШНЯ · БЕЗ ЧЕКПОИНТОВ', 26, 33);
        context.fillStyle = '#ffffff'; context.font = 'bold 20px sans-serif';
        const metrics = level.getTowerMetrics();
        const pendingKeystone = metrics.deckRelays.findIndex((ready, deck) => ready && !metrics.keystoneSolved[deck]);
        const progress = game.state === 'won' ? 'ВЕРШИНА · ФИНИШ' : pendingKeystone >= 0
          ? `УЗЕЛ ${pendingKeystone + 1} / ${settings.keystones}`
          : `КРЫЛО ${Math.min(settings.stages, level.completedStages + 1)} / ${settings.stages}`;
        context.fillText(progress, 26, 60);
        const seconds = Math.floor(observed.simulatedSeconds);
        const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        context.fillStyle = 'rgba(8, 17, 23, .88)'; context.fillRect(settings.width - 108, 14, 94, 40);
        context.fillStyle = '#ffffff'; context.font = 'bold 22px monospace'; context.textAlign = 'center';
        context.fillText(clock, settings.width - 61, 42); context.textAlign = 'left';
        return composed.toDataURL('image/jpeg', .84);
      };
      const still = async name => { game.render(); await window.__NESI_TOWER_SAVE_STILL__(name, jpeg()); };
      game.resetRun = function (...args) { observed.resetCalls++; return originals.reset.apply(this, args); };
      game.respawn = function (...args) { observed.respawnCalls++; return originals.respawn.apply(this, args); };
      game.physics.resetCargo = function (...args) { observed.cargoResetCalls++; return originals.cargoReset.apply(this, args); };
      game.updatePlaying = function (dt, ...args) {
        check(Math.abs(dt - 1 / settings.physicsHz) < 1e-10, 'Physics must advance at exactly 120 Hz');
        const before = game.playerPosition.clone();
        const result = originals.physics.call(this, dt, ...args);
        observed.physicsSteps++;
        observed.physicsSeconds += dt;
        observed.teleports = game.teleportCount - initialTeleports;
        // Measure every physical segment. Combining two physics steps into a
        // visual-frame chord undercounts stairs, landings and direction changes.
        observed.distanceMeters += before.distanceTo(game.playerPosition);
        // Observe real positions in the alternative spaces, independently of
        // the route's waypoint list or the static course descriptors.
        const p = game.playerPosition, deck = Math.min(5, Math.max(0, Math.floor((p.y + .15) / 8)));
        for (const stage of level.towerStages.slice(deck * 3, deck * 3 + 3)) {
          const [dx, dz] = stage.direction;
          const sx = p.x - stage.entry[0], sz = p.z - stage.entry[2];
          const s = 2 + sx * dx + sz * dz, n = -sx * dz + sz * dx;
          const topology = settings.courseTypes[stage.id];
          if (topology !== 'shaft' && (s < 30 || s > 36.5)) continue;
          const entered = topology === 'annex' ? Math.abs(n) > 7
            : topology === 'island' ? Math.abs(n) > 2.8
            : topology === 'terrace' ? p.y - stage.baseY > .85
            : topology === 'skybridge' ? n > 19 && p.y - stage.baseY > .95
            : topology === 'maze' ? Math.abs(n) > 11
            : topology === 'shaft' ? s > 22.2 && s < 30.9 && n > 3.35 && n < 5.65
              && game.playerGrounded && Math.abs(p.y - stage.baseY - 2.05) < .16 : false;
          if (entered && !courseSeen[topology].has(stage.id)) {
            courseSeen[topology].add(stage.id);
            observed.courseVisits[topology].push(stage.id);
          }
        }
        if (level.completedStages !== previousStage) {
          check(level.completedStages === previousStage + 1, 'Stage chronology skipped or moved backwards');
          const event = level.getTowerMetrics().stageEvents.at(-1);
          check(event?.stage === level.completedStages, 'Live puzzle event must match the observed completion');
          observed.stageEvents.push({stage: level.completedStages, id: event.id, deck: event.deck, branch: event.branch, frame: observed.frames, physicsStep: observed.physicsSteps,
            simulatedSeconds: observed.physicsSeconds, distanceMeters: observed.distanceMeters,
            player: game.playerPosition.toArray(), cargo: game.cargo.position.toArray()});
          previousStage = level.completedStages;
        }
        const keystones = level.getTowerMetrics().keystoneEvents;
        if (keystones.length !== previousKeystone) {
          check(keystones.length === previousKeystone + 1, 'Keystone chronology skipped or moved backwards');
          const event = keystones.at(-1);
          observed.keystoneEvents.push({deck: event.deck, id: event.id, frame: observed.frames,
            physicsStep: observed.physicsSteps, simulatedSeconds: observed.physicsSeconds,
            player: game.playerPosition.toArray(), cargo: game.cargo.position.toArray()});
          previousKeystone = keystones.length;
        }
        return result;
      };
      game.updateVisuals = function (dt, ...args) {
        const result = originals.visual.call(this, dt, ...args);
        if (dt <= 0) return result;
        check(Math.abs(dt - 1 / settings.visualHz) < 1e-10, 'Visual simulation must advance at exactly 60 Hz');
        check(game.levelIndex === 40 && game.physics.cargoBody.id === bodyId, 'Room or original companion changed');
        check(['playing', 'won'].includes(game.state), 'Tower left active gameplay');
        const distance = previousVisualPosition.distanceTo(game.playerPosition);
        const aim = Math.abs(Math.atan2(Math.sin(game.yaw - previousYaw), Math.cos(game.yaw - previousYaw))) + Math.abs(game.pitch - previousPitch);
        const moving = distance > .0001;
        const active = moving || aim > .0001;
        observed.activeSeconds += active ? dt : 0;
        observed.movingSeconds += moving ? dt : 0;
        idleSeconds = active ? 0 : idleSeconds + dt;
        stationarySeconds = moving ? 0 : stationarySeconds + dt;
        observed.maxIdleSeconds = Math.max(observed.maxIdleSeconds, idleSeconds);
        observed.maxStationarySeconds = Math.max(observed.maxStationarySeconds, stationarySeconds);
        check(idleSeconds <= 5 + 1e-6, 'More than five seconds passed without actual movement or aiming');
        previousVisualPosition.copy(game.playerPosition); previousYaw = game.yaw; previousPitch = game.pitch;
        observed.simulatedSeconds += dt;
        const current = state();
        observed.first ??= current; observed.last = current;
        check(level.completedStages === previousStage, 'Stage completion changed outside the physics update');
        if (record && observed.frames % settings.stride === 0) {
          game.render();
          batch.push({index: encodedFrames++, image: jpeg(), state: current});
          lastCapture = current;
          maxQueuedFrames = Math.max(maxQueuedFrames, batch.length);
          check(batch.length <= 120, 'The journey failed to flush its bounded frame batch within ten simulation seconds');
        }
        observed.frames++;
        if (observed.frames % 60 === 0) observed.telemetry.push({frame: observed.frames, completedStages: level.completedStages,
          simulatedSeconds: observed.simulatedSeconds, distanceMeters: observed.distanceMeters, activeSeconds: observed.activeSeconds, player: current.player, cargo: current.cargo});
        return result;
      };
      window.__NESI_TOWER_FLUSH_FRAMES__ = async () => {
        if (batch.length) { const pending = batch; batch = []; await window.__NESI_TOWER_WRITE_BATCH__(pending); }
        for (const [topology, seen] of Object.entries(courseSeen)) {
          if (seen.size && !courseStillSaved.has(topology)) {
            await still(`course-${topology}`);
            courseStillSaved.add(topology);
          }
        }
        if (!middleSaved && level.completedStages >= settings.stages / 2) { await still('middle'); middleSaved = true; }
        await window.__NESI_TOWER_PROGRESS__({completedStages: level.completedStages, simulatedSeconds: observed.simulatedSeconds, distanceMeters: observed.distanceMeters, encodedFrames});
      };
      try {
        await still('start');
        const route = await window.__NESI_RUN_LEVEL_ROUTE__();
        // If victory falls between samples, append only the few regular visual
        // samples needed to show it. Do not advance physics or alter the route.
        if (record && lastCapture?.state !== 'won') {
          for (let padding = 0; padding < settings.stride && lastCapture?.state !== 'won'; padding++) {
            originals.visual.call(game, 1 / settings.visualHz, 1);
            const visualFrame = observed.frames + padding;
            if (visualFrame % settings.stride === 0) {
              game.render();
              lastCapture = {...state(), visualFrame};
              batch.push({index: encodedFrames++, image: jpeg(), state: lastCapture});
            }
          }
        }
        await window.__NESI_TOWER_FLUSH_FRAMES__();
        await still('finish');
        return {route, observed, encodedFrames, maxQueuedFrames, lastCapture, gameMetrics: level.getTowerMetrics(),
          width: game.renderer.domElement.width, height: game.renderer.domElement.height};
      } catch (error) {
        window.__NESI_TOWER_LAST_FAILURE__ = {observed, encodedFrames, maxQueuedFrames, state: state(),
          gameMetrics: level.getTowerMetrics(), routeReport: error.towerReport || null};
        throw error;
      } finally {
        game.updateVisuals = originals.visual; game.updatePlaying = originals.physics;
        game.resetRun = originals.reset; game.respawn = originals.respawn; game.physics.resetCargo = originals.cargoReset;
        if (originals.flush) window.__NESI_TOWER_FLUSH_FRAMES__ = originals.flush;
        else delete window.__NESI_TOWER_FLUSH_FRAMES__;
      }
    }, {record, settings: {...TOWER_CAPTURE,courseTypes:Object.fromEntries(Object.entries(TOWER_COURSE_TYPES).map(([id,type])=>[id,COURSE_SHORT[type]]))}});
    const evidence = {...result, sourceCommit: info.commit, version: info.version, title, url: url.href, errors, graphicsPreset, graphicsBenchmark,
      method: 'Ordinary scripted input through production physics, 60 Hz visual and 120 Hz physics simulation. Not a human playtest or a hardware FPS benchmark.'};
    fs.writeFileSync(path.join(out, 'tower-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
    validateTowerEvidence(evidence);
    assert.equal(result.width, TOWER_CAPTURE.width); assert.equal(result.height, TOWER_CAPTURE.height);
    await page.screenshot({path: path.join(out, 'tower-win.png')});
    console.log('TOWER VERIFIED', JSON.stringify({sourceCommit: info.commit, wings: TOWER_CAPTURE.stages, simulatedSeconds: result.observed.simulatedSeconds,
      activeSeconds: result.observed.activeSeconds, distanceMeters: result.observed.distanceMeters,
      teleports: result.observed.teleports, maxIdleSeconds: result.observed.maxIdleSeconds}));
    return evidence;
  } catch (error) {
    const details = page ? await page.evaluate(() => window.__NESI_TOWER_LAST_FAILURE__ || null).catch(() => null) : null;
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({error: String(error), errors, details}, null, 2) + '\n');
    if (page) await page.screenshot({path: path.join(out, 'tower-failure.png')}).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await runTowerVerification();
