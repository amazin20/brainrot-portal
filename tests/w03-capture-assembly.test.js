import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCaptureParts } from '../scripts/w03-assemble-capture.mjs';
const hash = 'a'.repeat(64);
function fixture() {
  const trace = Array.from({ length: 6 }, (_, i) => ({ index: i, visualFrame: i * 2, elapsedMs: i * 1000 / 30,
    player: [i, 12, 0], cargo: [i, 12.5, 1], cargoBodyId: 9, state: i === 5 ? 'won' : 'playing', guardProgress: 1, poseSHA256: hash }));
  return [0, 1].map(part => ({ part, parts: 2, commit: 'a'.repeat(40), variant: 'cargo-first', parameters: {}, pass: true,
    route: { pass: true, level: 21, resets: 0, respawns: 0 }, models: [{ id: 2, sha256: hash }], errors: [], trace: structuredClone(trace),
    frames: trace.filter(f => f.index % 2 === part).map(f => ({ ...f, sha256: hash })),
    video: { width: 1280, height: 720, encodedFps: 30, physicsHz: 120 } }));
}
test('native strided parts form one complete ordered route only after trace agreement', () => {
  assert.deepEqual(validateCaptureParts(fixture()).frames.map(f => f.index), [0, 1, 2, 3, 4, 5]);
});
test('different runtime numeric body ids are allowed, but identity is constant inside each replay', () => {
  const reports = fixture(); for (const f of [...reports[1].trace, ...reports[1].frames]) f.cargoBodyId = 12;
  assert.equal(validateCaptureParts(reports).frames.length, 6);
  reports[1].trace[2].cargoBodyId = 13; assert.throws(() => validateCaptureParts(reports));
});
for (const [name, breakIt] of Object.entries({
  missingImage: r => r[0].frames.pop(), duplicateIndex: r => r[0].frames[1].index = 0,
  mixedCommit: r => r[1].commit = 'b'.repeat(40), changedPose: r => r[1].trace[2].poseSHA256 = 'b'.repeat(64),
  changedPhysics: r => r[1].trace[2].cargo[0] += .1,
  alteredModel: r => r[1].models[0].sha256 = 'b'.repeat(64), missingPart: r => r.pop(),
  missingVictory: r => { for (const p of r) { p.trace.at(-1).state = 'playing'; for (const f of p.frames) if (f.index === 5) f.state = 'playing'; } },
})) test(`capture assembly rejects ${name}`, () => { const r = fixture(); breakIt(r); assert.throws(() => validateCaptureParts(r)); });
