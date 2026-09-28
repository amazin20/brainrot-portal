/** Record only Tower 41, without rebuilding or re-recording the first 40 rooms. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {runTowerVerification, TOWER_CAPTURE} from './verify-tower.mjs';

const out = path.resolve(process.env.OUT_DIR || 'qa/tower-walkthrough');
const frameDir = path.join(out, 'frames');
const movie = path.join(out, 'level-41.mp4');
fs.mkdirSync(frameDir, {recursive: true});
assert.equal(fs.readdirSync(frameDir).length, 0, 'Use an empty frame directory; never combine partial recording runs');
let frameCount = 0, firstFrame = null, lastFrame = null, bodyId = null;
const started = Date.now();
const evidence = await runTowerVerification({out, record: true, writeBatch: async batch => {
  assert.ok(Array.isArray(batch) && batch.length > 0 && batch.length <= 120, 'Frame writes must be bounded');
  for (const {index, image, state} of batch) {
    assert.equal(index, frameCount, 'Every MP4 frame must arrive once, in order');
    assert.equal(state.visualFrame, index * TOWER_CAPTURE.stride, 'The video must have continuous 12 Hz simulation samples');
    assert.equal(state.level, 41);
    assert.ok(['playing', 'won'].includes(state.state));
    bodyId ??= state.cargoBodyId;
    assert.equal(state.cargoBodyId, bodyId, 'Original companion changed during capture');
    assert.match(image, /^data:image\/jpeg;base64,/);
    const bytes = Buffer.from(image.slice(image.indexOf(',') + 1), 'base64');
    assert.equal(bytes.readUInt16BE(0), 0xffd8);
    assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9);
    fs.writeFileSync(path.join(frameDir, `${String(index).padStart(6, '0')}.jpg`), bytes);
    firstFrame ??= state; lastFrame = state; frameCount++;
  }
  if (frameCount % 120 === 0) console.log(`Tower recording ${Math.round(frameCount / 12)} simulated seconds / ${Math.round((Date.now() - started) / 1000)} wall seconds; ${frameCount} frames written`);
}});
assert.equal(frameCount, evidence.encodedFrames);
assert.ok(frameCount >= 900 * TOWER_CAPTURE.fps, 'A full recording must last at least 15 minutes');
assert.equal(firstFrame.visualFrame, 0);
assert.equal(firstFrame.completedStages, 0);
assert.equal(lastFrame.state, 'won');
assert.equal(lastFrame.completedStages, 500);
assert.ok(Math.abs(frameCount / TOWER_CAPTURE.fps - evidence.observed.simulatedSeconds) < .1, 'Encoded time must remain 1× simulation time');
fs.copyFileSync(path.join(frameDir, '000000.jpg'), path.join(out, 'level-41.jpg'));
console.log(`Encoding ${frameCount} complete Tower frames at ${TOWER_CAPTURE.fps} fps`);
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'warning', '-y', '-framerate', String(TOWER_CAPTURE.fps),
  '-i', path.join(frameDir, '%06d.jpg'), '-frames:v', String(frameCount), '-c:v', 'libx264', '-preset', 'fast', '-crf', '27',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-threads', '2', '-an', movie], {timeout: 1_800_000, stdio: 'inherit'});
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
  'stream=codec_type,codec_name,width,height,avg_frame_rate,nb_frames,pix_fmt', '-show_entries', 'format=duration,size', '-of', 'json', movie], {encoding: 'utf8'}));
assert.equal(probe.streams.length, 1, 'The recording contains one silent video track');
const stream = probe.streams[0];
assert.equal(stream.codec_type, 'video'); assert.equal(stream.codec_name, 'h264');
assert.equal(stream.width, TOWER_CAPTURE.width); assert.equal(stream.height, TOWER_CAPTURE.height);
assert.equal(stream.pix_fmt, 'yuv420p'); assert.equal(stream.avg_frame_rate, '12/1');
assert.equal(Number(stream.nb_frames), frameCount);
assert.ok(Math.abs(Number(probe.format.duration) - frameCount / TOWER_CAPTURE.fps) < .1);
const hash = createHash('sha256');
for await (const chunk of fs.createReadStream(movie)) hash.update(chunk);
const bytes = fs.statSync(movie).size;
assert.equal(Number(probe.format.size), bytes);
const report = {level: 41, title: evidence.title, sourceCommit: evidence.sourceCommit, edition: 'foundation', version: evidence.version,
  route: evidence.route, observed: evidence.observed, gameMetrics: evidence.gameMetrics, continuous: true,
  frameCount, fps: 12, width: TOWER_CAPTURE.width, height: TOWER_CAPTURE.height, durationSeconds: frameCount / 12,
  firstFrame, lastFrame, milestones: evidence.observed.stageEvents, maxQueuedFrames: evidence.maxQueuedFrames, sha256: hash.digest('hex'), bytes,
  video: 'level-41.mp4', poster: 'level-41.jpg', stills: ['tower-start.jpg', 'tower-middle.jpg', 'tower-finish.jpg'],
  overlay: 'Stage count and elapsed simulation time from the actual captured frame; no checkpoints.',
  method: 'Complete ordinary-input Tower route, native WebGL canvas with factual stage/time overlay, continuous 12 fps samples from 60 Hz visuals and 120 Hz physics at 1× simulation speed. Silent. Not human playtest or hardware FPS.'};
fs.writeFileSync(path.join(out, 'level-41.json'), JSON.stringify(report, null, 2) + '\n');
fs.rmSync(frameDir, {recursive: true});
console.log('TOWER VIDEO VERIFIED', JSON.stringify({sourceCommit: report.sourceCommit, stages: 500, durationSeconds: report.durationSeconds,
  frameCount, bytes, sha256: report.sha256, wallSeconds: (Date.now() - started) / 1000}));
