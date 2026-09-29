/** Extra route coverage of an existing Tower artifact; never rebuild or publish it. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const out = path.resolve(process.env.OUT_DIR || 'qa/tower-alternatives');
const expectedCommit = process.env.TOWER_SOURCE_COMMIT;
assert.match(expectedCommit || '', /^[a-f0-9]{40}$/, 'Pin the original game commit');
fs.mkdirSync(out, {recursive: true});
const cases = [
  {id: 'reverse-full-hoist', branchOrder: [2, 1, 0], freightRoute: 'hoist'},
  {id: 'west-first-full-carry', branchOrder: [1, 0, 2], freightRoute: 'carry'},
  {id: 'east-north-west-first-deck', branchOrder: [0, 2, 1], stopAfterDeck: 0},
  {id: 'west-north-east-first-deck', branchOrder: [1, 2, 0], stopAfterDeck: 0},
  {id: 'north-east-west-first-deck', branchOrder: [2, 0, 1], stopAfterDeck: 0},
];
const summary = {sourceCommit: expectedCommit, auditCommit: process.env.GITHUB_SHA || null,
  method: 'Ordinary scripted movement, jump, interaction and portal shots through the unchanged production artifact. Not a human playtest, video or minimum-time proof.',
  cases: [], pass: false};
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
  protocolTimeout: 1_800_000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const flush = () => fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');

async function snapshot(page) {
  return page.evaluate(() => {
    const game = window.__NESI_DEMO_GAME__, level = game.firstLevel;
    return {state: game.state, level: game.levelIndex + 1, stages: level.completedStages,
      atSpawn: game.playerPosition.distanceTo(level.spawn) < 2,
      metrics: level.getTowerMetrics()};
  });
}
function assertFresh(state) {
  assert.equal(state.level, 41);
  assert.equal(state.stages, 0, 'A new attempt cannot restore a solved wing');
  assert.equal(state.atSpawn, true, 'Restart at the Tower base');
  assert.equal(state.metrics.checkpoints, false);
  assert.deepEqual(state.metrics.solvedIds, []);
  assert.deepEqual(state.metrics.deckRelays, [false, false, false, false, false, false]);
  assert.deepEqual(state.metrics.keystoneSolved, [false, false, false, false, false, false]);
}
try {
  for (const scenario of cases) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(180_000);
    await page.setViewport({width: 854, height: 480, deviceScaleFactor: 1});
    page.on('pageerror', error => errors.push(String(error)));
    const started = Date.now();
    const result = {id: scenario.id, options: {...scenario, enforceDuration: false}, pass: false};
    delete result.options.id;
    console.log('START', scenario.id);
    try {
      const url = new URL(process.env.PAGE_URL || 'http://127.0.0.1:4173/');
      url.searchParams.set('edition', 'foundation'); url.searchParams.set('level', '41'); url.searchParams.set('debug', '1');
      await page.goto(url.href, {waitUntil: 'networkidle2'});
      await page.waitForFunction(() => window.__NESI_DEMO_GAME__?.state === 'ready');
      const info = await page.evaluate(async () => {
        const response = await fetch('build-info.json', {cache: 'no-store'});
        if (!response.ok) throw Error(`Build metadata HTTP ${response.status}`);
        return response.json();
      });
      assert.equal(info.commit, expectedCommit, 'Never test a silently rebuilt package');
      assert.equal(info.version, 'v44-tower-variety');
      assert.equal(info.levels, 41);
      result.package = info;
      assertFresh(await snapshot(page));
      await page.select('#quality-select', 'low');
      await page.waitForFunction(() => {
        const menu = document.querySelector('#start-screen');
        return menu && !menu.inert && getComputedStyle(menu).opacity === '1';
      });
      await page.bringToFront(); await page.focus('#play-button'); await page.click('#play-button');
      await page.waitForFunction(() => window.__NESI_DEMO_GAME__?.state === 'playing');
      const evidence = await page.evaluate(async options => {
        const game = window.__NESI_DEMO_GAME__;
        const companion = game.cargo, bodyId = game.physics.cargoBody.id;
        try {
          const report = await window.__NESI_RUN_LEVEL_ROUTE__(options);
          return {report, sameCompanion: companion === game.cargo, sameBody: bodyId === game.physics.cargoBody.id,
            state: game.state, metrics: game.firstLevel.getTowerMetrics()};
        } catch (error) {
          return {error: String(error), report: error.towerReport || null,
            state: game.state, metrics: game.firstLevel.getTowerMetrics()};
        }
      }, result.options);
      result.evidence = evidence;
      assert.equal(evidence.error, undefined, evidence.error);
      const report = evidence.report, partial = scenario.stopAfterDeck === 0;
      assert.equal(evidence.sameCompanion, true);
      assert.equal(evidence.sameBody, true);
      for (const key of ['respawns', 'resets', 'cargoResets']) assert.equal(report[key], 0, key);
      assert.equal(report.stagesCompleted, partial ? 3 : 18);
      assert.equal(report.keystoneEvents.length, partial ? 1 : 6);
      assert.equal(report.stageEvents.length, partial ? 3 : 18);
      assert.deepEqual(report.stageEvents.map(event => event.branch),
        Array.from({length: partial ? 1 : 6}, () => scenario.branchOrder).flat());
      assert.deepEqual(report.stageEvents.map(event => event.deck),
        Array.from({length: partial ? 1 : 6}, (_, deck) => [deck, deck, deck]).flat());
      assert.equal(new Set(report.stageEvents.map(event => event.id)).size, partial ? 3 : 18);
      assert.equal(evidence.metrics.checkpoints, false);
      assert.ok(report.teleports > 0 && report.shots > 0);
      assert.ok(report.maxIdleSeconds <= 5 && report.maxNoInputSeconds <= 5);
      if (partial) {
        assert.equal(report.partial, true);
        assert.equal(evidence.state, 'playing');
      } else {
        assert.equal(report.pass, true);
        assert.equal(evidence.state, 'won');
        assert.equal(report.ascentEvents.length, 5);
        assert.deepEqual(evidence.metrics.keystoneSolved, [true, true, true, true, true, true]);
      }
      await page.screenshot({path: path.join(out, `${scenario.id}.png`)});
      if (partial) {
        // Test public controls after the completed partial route, not by assigning state.
        await page.click('#pause-button');
        await page.waitForFunction(() => window.__NESI_DEMO_GAME__.state === 'paused');
        await page.click('#restart-button');
        await page.waitForFunction(() => window.__NESI_DEMO_GAME__.state === 'playing');
        result.restart = await snapshot(page); assertFresh(result.restart);
      }
      // A page reload must never resume an in-Tower checkpoint, even after victory.
      await page.reload({waitUntil: 'networkidle2'});
      await page.waitForFunction(() => window.__NESI_DEMO_GAME__?.state === 'ready');
      result.reload = await snapshot(page); assertFresh(result.reload);
      assert.deepEqual(errors, [], 'Production page errors');
      result.pass = true;
    } catch (error) {
      result.error = String(error);
      await page.screenshot({path: path.join(out, `${scenario.id}-failure.png`)}).catch(() => {});
      console.error('FAIL', scenario.id, result.error);
    } finally {
      result.browserErrors = errors; result.wallSeconds = (Date.now() - started) / 1000;
      fs.writeFileSync(path.join(out, `${scenario.id}.json`), JSON.stringify(result, null, 2) + '\n');
      const r = result.evidence?.report;
      summary.cases.push({id: result.id, pass: result.pass, error: result.error || null,
        stages: r?.stagesCompleted ?? null, simulatedSeconds: r?.simulatedSeconds ?? null,
        activeInputSeconds: r?.activeInputSeconds ?? null, teleports: r?.teleports ?? null,
        branchOrder: scenario.branchOrder, freightRoute: scenario.freightRoute || 'hoist',
        publicRestartVerified: Boolean(result.restart && result.pass), reloadVerified: Boolean(result.reload && result.pass),
        wallSeconds: result.wallSeconds});
      flush(); console.log('END', JSON.stringify(summary.cases.at(-1)));
      await context.close();
    }
  }
  summary.pass = summary.cases.length === cases.length && summary.cases.every(item => item.pass);
  flush();
  assert.equal(summary.pass, true, 'One or more alternative routes or attempt-reset checks failed');
} finally { await browser.close(); }
