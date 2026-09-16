import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const base = (process.env.PAGE_URL || 'http://127.0.0.1:4173/').replace(/\/$/, '') + '/';
const tag = process.env.P01_TAG || 'after', fixed = process.env.P01_FIXED !== '0';
assert.match(tag, /^[a-z-]+$/);
const dist = process.env.DIST_DIR || 'dist', out = `smoke-artifacts/p01-${tag}`;
fs.mkdirSync(out, { recursive: true });
const chunk = stem => {
  const files = fs.readdirSync(path.join(dist, 'assets')).filter(n => n.startsWith(stem + '-') && n.endsWith('.js'));
  assert.equal(files.length, 1); return new URL(`assets/${files[0]}`, base).href;
};
const report = { source: process.env.SOURCE_COMMIT || null, tag, pass: false, states: [], errors: [],
  scope: 'Native Chromium screenshots after an ordinary portal approach and actual E keypresses. Not a full playthrough or hardware benchmark; sound event counts, not an audio recording.' };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true, protocolTimeout: 180000, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
  page.setDefaultTimeout(120000); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(base + '?level=21&debug=1&smoke=1', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.__NESI_DEMO_GAME__?.state === 'playing');
  await page.evaluate(() => window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
  const refresh = async () => {
    await new Promise(resolve => setTimeout(resolve, 220));
    await page.evaluate(() => { const g = window.__NESI_DEMO_GAME__; g.updateVisuals(1 / 60, 1); g.render(); });
  };
  for (const loaded of [false, true]) {
    const approach = await page.evaluate(async ({ routeURL, roomURL, loaded }) => {
      const { runV8Journey } = await import(routeURL);
      const { installRoom21Aim, room21Freight } = await import(roomURL);
      const g = window.__NESI_DEMO_GAME__;
      return runV8Journey(g, { scenario: d => {
        installRoom21Aim(d);
        if (loaded) room21Freight(d);
        d.walk(-10, 14); d.aim(0, d.level.panels['departure-entry'].getFrame().center);
        d.walk(-14, 13); d.aim(1, d.level.panels['brake-bay'].getFrame().center);
        d.enter(d.level.panels['departure-entry']); d.walk(-15.5, -12.2);
        d.look(d.level.state['cassette-brakeControl'].position); d.wait(.3);
      } });
    }, { routeURL: chunk('LabV8Journey'), roomURL: chunk('LabRoom21Journey'), loaded });
    assert.ok(approach.pass && approach.resets === 0 && approach.respawns === 0);
    await page.evaluate(() => {
      const g = window.__NESI_DEMO_GAME__, original = g.audio.mechanism;
      window.__P01_EVENTS__ = [];
      g.audio.mechanism = function (...args) { window.__P01_EVENTS__.push(args[0]); return original.apply(this, args); };
      window.__P01_RESTORE__ = () => { g.audio.mechanism = original; };
    });
    for (const braked of [true, false]) {
      if (!braked) {
        await page.keyboard.press('KeyE');
        await page.evaluate(() => {
          const g = window.__NESI_DEMO_GAME__;
          for (let n = 0; n < 12; n++) { g.updatePlaying(1 / 120); g.updateVisuals(1 / 120, 1); }
        });
      }
      await refresh();
      const state = await page.evaluate(() => {
        const g = window.__NESI_DEMO_GAME__, e = document.querySelector('.lab-tutorial');
        return { braked: g.firstLevel.cassette.braked, loaded: g.firstLevel.state.cargoSeat.loaded(),
          prompt: e.querySelector('span').textContent, hidden: e.hidden, events: [...window.__P01_EVENTS__],
          player: g.playerPosition.toArray(), height: g.firstLevel.cassette.height };
      });
      assert.equal(state.braked, braked); assert.equal(state.loaded, loaded);
      const file = `${loaded ? 'loaded' : 'empty'}-${braked ? 'locked' : 'released'}.png`;
      await page.screenshot({ path: path.join(out, file) });
      report.states.push({ ...state, file, approach });
      if (fixed) {
        assert.equal(state.hidden, false);
        assert.ok(state.prompt.includes(braked ? 'Тормоз зажат.' : 'Тормоз отпущен.'));
        assert.ok(state.prompt.includes(loaded ? 'На приёмнике есть груз.' : 'Приёмник пуст.'));
        assert.deepEqual(state.events, braked ? [] : ['switch']);
      } else {
        assert.deepEqual(state.events, braked ? [] : ['switch', 'switch']);
      }
    }
    await page.evaluate(() => window.__P01_RESTORE__());
  }
  if (!fixed) {
    assert.equal(report.states[0].prompt, report.states[1].prompt);
    assert.equal(report.states[2].prompt, report.states[3].prompt);
  }
  assert.deepEqual(report.errors, []); report.pass = true;
} catch (error) { report.failure = error.stack; throw error; }
finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
