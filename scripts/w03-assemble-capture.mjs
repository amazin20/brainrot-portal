import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const canonicalTrace = trace => JSON.stringify(trace.map(({ cargoBodyId, ...state }) => state));

/** Every worker replays the whole route, drawing a disjoint stride of frames.
 * Reject any replay/pose difference, missing image or altered image before muxing.
 * Native frame rate and logical identity are not hardware performance claims. */
export function validateCaptureParts(reports) {
  assert.ok(reports.length > 0, 'No capture parts');
  const reference = reports[0], parts = reference.parts;
  assert.equal(reports.length, parts, 'Missing capture part');
  assert.equal(new Set(reports.map(r => r.part)).size, parts, 'Duplicate capture part');
  assert.ok(typeof reference.commit === 'string' && /^[a-f0-9]{40}$/.test(reference.commit), 'Source commit required');
  assert.ok(reference.trace.length > 0, 'Empty route trace');
  const expected = canonicalTrace(reference.trace), frames = [];
  for (const report of reports) {
    assert.ok(report.pass && report.route.pass && report.route.level === 21, 'Failed route');
    assert.equal(report.route.resets, 0); assert.equal(report.route.respawns, 0);
    assert.ok(Number.isInteger(report.part) && report.part >= 0 && report.part < parts);
    assert.equal(report.parts, parts); assert.equal(report.commit, reference.commit, 'Mixed source commits');
    assert.equal(report.variant, reference.variant); assert.deepEqual(report.parameters, reference.parameters);
    assert.deepEqual(report.models, reference.models, 'Mixed model assets');
    assert.deepEqual(report.errors, []); assert.equal(sha(canonicalTrace(report.trace)), sha(expected), 'Replay state or animation pose diverged');
    assert.equal(new Set(report.trace.map(f => f.cargoBodyId)).size, 1, 'Companion identity changed within a replay');
    assert.equal(report.video.encodedFps, 30); assert.equal(report.video.physicsHz, 120);
    assert.equal(report.video.width, 1280); assert.equal(report.video.height, 720);
    for (const frame of report.frames) {
      assert.equal(frame.index % parts, report.part, 'Frame belongs to the wrong capture part');
      const source = report.trace[frame.index]; assert.ok(source, 'Frame outside trace');
      for (const key of ['visualFrame', 'elapsedMs', 'player', 'cargo', 'state', 'guardProgress', 'cargoBodyId'])
        assert.deepEqual(frame[key], source[key], `Frame state mismatch: ${key}`);
      assert.match(frame.sha256, /^[a-f0-9]{64}$/);
      frames.push({ ...frame, part: report.part });
    }
  }
  frames.sort((a, b) => a.index - b.index);
  assert.equal(frames.length, reference.trace.length, 'Missing native frames');
  for (let i = 0; i < frames.length; i++) {
    assert.equal(frames[i].index, i, 'Missing or duplicated frame');
    assert.match(reference.trace[i].poseSHA256, /^[a-f0-9]{64}$/);
    if (i) { assert.equal(frames[i].visualFrame - frames[i - 1].visualFrame, 2); assert.ok(frames[i].elapsedMs >= frames[i - 1].elapsedMs); }
  }
  assert.equal(frames.at(-1).state, 'won', 'Recording does not end in a joint victory');
  return { frames, traceSHA256: sha(expected), reference };
}

export function assembleCapture(root, out, { encode = true } = {}) {
  const directories = fs.readdirSync(root).filter(name => /^part-\d+$/.test(name));
  const reports = directories.map(name => JSON.parse(fs.readFileSync(path.join(root, name, 'report.json'), 'utf8')));
  const checked = validateCaptureParts(reports), { frames, reference } = checked;
  const destination = path.join(out, 'frames'); fs.mkdirSync(destination, { recursive: true });
  for (const frame of frames) {
    const name = `${String(frame.index).padStart(6, '0')}.jpg`;
    const bytes = fs.readFileSync(path.join(root, `part-${frame.part}`, 'frames', name));
    assert.equal(sha(bytes), frame.sha256, 'Native frame hash mismatch');
    fs.writeFileSync(path.join(destination, name), bytes);
  }
  for (const [i, mark] of reference.milestones.entries()) {
    const name = `${String(mark.encodedFrame).padStart(6, '0')}.jpg`;
    fs.copyFileSync(path.join(destination, name), path.join(out, `milestone-${String(i).padStart(2, '0')}.jpg`));
  }
  const movie = path.join(out, `${reference.variant}.mp4`);
  if (encode) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(destination, '%06d.jpg'),
    '-frames:v', String(frames.length), '-c:v', 'libx264', '-preset', 'fast', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', movie]);
  const report = { ...reference, part: undefined, pass: true, frames, trace: reference.trace,
    assembly: { parts: reference.parts, traceSHA256: checked.traceSHA256, allReplayStatesAndPosesIdentical: true,
      allNativeFramesPresentAndHashed: true, initialVisualClock: 0,
      note: 'Each worker runs the complete ordinary route with fixed initial presentation clock; its own persistent companion is retained. Frame indices interleave only after all full state/camera/actor-pose traces match.' },
    video: { ...reference.video, frames: frames.length, durationSeconds: frames.length / 30,
      sha256: encode ? sha(fs.readFileSync(movie)) : null },
  };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [root, out] = process.argv.slice(2);
  assert.ok(root && out, 'Usage: node scripts/w03-assemble-capture.mjs INPUT_DIRECTORY OUTPUT_DIRECTORY');
  const report = assembleCapture(root, out);
  console.log('Verified full native movie', report.variant, report.video.durationSeconds, 'seconds');
}
