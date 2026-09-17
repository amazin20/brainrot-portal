from pathlib import Path
import subprocess
root = Path.cwd()
payload = Path('/tmp/p04b-payload')
subprocess.run(['git', 'apply', '--check', str(payload / 'maintenance/p04b-camera.patch')], check=True)
subprocess.run(['git', 'apply', str(payload / 'maintenance/p04b-camera.patch')], check=True)
s = (root / 'scripts/p04-exit-camera-browser.mjs').read_text()
s = s.replace("'smoke-artifacts/p04'", "'smoke-artifacts/p04b'")
s = s.replace('return{event,held:a[0]?.held,earlyFrames:', '''const postSteps=a.slice(1).map((s,i)=>({time:s.after,distance:Math.hypot(...s.camera.map((v,j)=>v-a[i].camera[j]))}));
  return{event,held:a[0]?.held,postFrames:a.length,postMinRetained:Math.min(...a.map(s=>s.skin.retained)),
   maxLateCameraStep:Math.max(0,...postSteps.filter(s=>s.time>=.4).map(s=>s.distance)),earlyFrames:''')
s = s.replace('assert.equal(s.unsafeFrames,0);', '''assert.equal(s.unsafeFrames,0);
  assert.equal(s.postFrames,120);assert.equal(s.laterLost,0,JSON.stringify(s));assert.ok(s.postMinRetained>500);
  if(s.event===4)assert.ok(s.maxLateCameraStep<3.48,`Late correction exceeded retained baseline: ${s.maxLateCameraStep}`);''')
(root / 'scripts/p04b-framing-browser.mjs').write_text(s)
